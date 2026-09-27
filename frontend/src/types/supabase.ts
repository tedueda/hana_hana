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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: number
          ip: unknown
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: never
          ip?: unknown
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: never
          ip?: unknown
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          role: Database["public"]["Enums"]["admin_role_t"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["admin_role_t"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["admin_role_t"]
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body_ja: string
          body_ko: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          published_at: string | null
          title_ja: string
          title_ko: string
        }
        Insert: {
          body_ja: string
          body_ko: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title_ja: string
          title_ko: string
        }
        Update: {
          body_ja?: string
          body_ko?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title_ja?: string
          title_ko?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          match_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          match_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      interests: {
        Row: {
          category: string | null
          id: string
          is_active: boolean
          name_en: string
          name_ja: string
          name_ko: string
          slug: string
          sort_order: number
        }
        Insert: {
          category?: string | null
          id?: string
          is_active?: boolean
          name_en: string
          name_ja: string
          name_ko: string
          slug: string
          sort_order?: number
        }
        Update: {
          category?: string | null
          id?: string
          is_active?: boolean
          name_en?: string
          name_ja?: string
          name_ko?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          grants_tier: Database["public"]["Enums"]["member_tier_t"]
          id: string
          is_active: boolean
          label: string | null
          max_uses: number | null
          owner_user_id: string | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          grants_tier?: Database["public"]["Enums"]["member_tier_t"]
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          owner_user_id?: string | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          grants_tier?: Database["public"]["Enums"]["member_tier_t"]
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          owner_user_id?: string | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          is_active: boolean
          name_en: string
          name_ja: string
          name_ko: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          name_en: string
          name_ja: string
          name_ko: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          name_en?: string
          name_ja?: string
          name_ko?: string
          sort_order?: number
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: Database["public"]["Enums"]["like_status_t"]
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: Database["public"]["Enums"]["like_status_t"]
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: Database["public"]["Enums"]["like_status_t"]
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          id: string
          is_active: boolean
          matched_at: string
          unmatched_at: string | null
          unmatched_by: string | null
          user_high_id: string
          user_low_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          matched_at?: string
          unmatched_at?: string | null
          unmatched_by?: string | null
          user_high_id: string
          user_low_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          matched_at?: string
          unmatched_at?: string | null
          unmatched_by?: string | null
          user_high_id?: string
          user_low_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_unmatched_by_fkey"
            columns: ["unmatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_unmatched_by_fkey"
            columns: ["unmatched_by"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_high_id_fkey"
            columns: ["user_high_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_high_id_fkey"
            columns: ["user_high_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_low_id_fkey"
            columns: ["user_low_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_low_id_fkey"
            columns: ["user_low_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      message_translations: {
        Row: {
          created_at: string
          message_id: string
          provider: string | null
          target_lang: string
          translated_body: string
        }
        Insert: {
          created_at?: string
          message_id: string
          provider?: string | null
          target_lang: string
          translated_body: string
        }
        Update: {
          created_at?: string
          message_id?: string
          provider?: string | null
          target_lang?: string
          translated_body?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_translations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string
          body_lang: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          body_lang?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          body_lang?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          is_read: boolean
          payload: Json | null
          type: Database["public"]["Enums"]["notification_type_t"]
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json | null
          type: Database["public"]["Enums"]["notification_type_t"]
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json | null
          type?: Database["public"]["Enums"]["notification_type_t"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          id: string
          interval: string | null
          is_active: boolean
          name_ja: string
          name_ko: string
          stripe_price_id: string | null
        }
        Insert: {
          code: string
          id?: string
          interval?: string | null
          is_active?: boolean
          name_ja: string
          name_ko: string
          stripe_price_id?: string | null
        }
        Update: {
          code?: string
          id?: string
          interval?: string | null
          is_active?: boolean
          name_ja?: string
          name_ko?: string
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      profile_photos: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          sort_order: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          birthdate: string | null
          created_at: string
          deleted_at: string | null
          gender: Database["public"]["Enums"]["gender_t"] | null
          id: string
          invite_code_id: string | null
          is_public: boolean
          last_active_at: string | null
          meeting_pref: Database["public"]["Enums"]["meeting_pref_t"] | null
          member_tier: Database["public"]["Enums"]["member_tier_t"]
          nationality: Database["public"]["Enums"]["nationality_t"] | null
          nickname: string | null
          occupation: string | null
          onboarding_completed: boolean
          pref_age_max: number | null
          pref_age_min: number | null
          pref_gender: Database["public"]["Enums"]["gender_t"][] | null
          pref_nationality:
            | Database["public"]["Enums"]["nationality_t"][]
            | null
          preferred_ui_lang: string
          residence_country: Database["public"]["Enums"]["country_t"] | null
          residence_region_id: string | null
          status: Database["public"]["Enums"]["account_status_t"]
          status_reason: string | null
          suspended_until: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          deleted_at?: string | null
          gender?: Database["public"]["Enums"]["gender_t"] | null
          id: string
          invite_code_id?: string | null
          is_public?: boolean
          last_active_at?: string | null
          meeting_pref?: Database["public"]["Enums"]["meeting_pref_t"] | null
          member_tier?: Database["public"]["Enums"]["member_tier_t"]
          nationality?: Database["public"]["Enums"]["nationality_t"] | null
          nickname?: string | null
          occupation?: string | null
          onboarding_completed?: boolean
          pref_age_max?: number | null
          pref_age_min?: number | null
          pref_gender?: Database["public"]["Enums"]["gender_t"][] | null
          pref_nationality?:
            | Database["public"]["Enums"]["nationality_t"][]
            | null
          preferred_ui_lang?: string
          residence_country?: Database["public"]["Enums"]["country_t"] | null
          residence_region_id?: string | null
          status?: Database["public"]["Enums"]["account_status_t"]
          status_reason?: string | null
          suspended_until?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          deleted_at?: string | null
          gender?: Database["public"]["Enums"]["gender_t"] | null
          id?: string
          invite_code_id?: string | null
          is_public?: boolean
          last_active_at?: string | null
          meeting_pref?: Database["public"]["Enums"]["meeting_pref_t"] | null
          member_tier?: Database["public"]["Enums"]["member_tier_t"]
          nationality?: Database["public"]["Enums"]["nationality_t"] | null
          nickname?: string | null
          occupation?: string | null
          onboarding_completed?: boolean
          pref_age_max?: number | null
          pref_age_min?: number | null
          pref_gender?: Database["public"]["Enums"]["gender_t"][] | null
          pref_nationality?:
            | Database["public"]["Enums"]["nationality_t"][]
            | null
          preferred_ui_lang?: string
          residence_country?: Database["public"]["Enums"]["country_t"] | null
          residence_region_id?: string | null
          status?: Database["public"]["Enums"]["account_status_t"]
          status_reason?: string | null
          suspended_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_preferred_ui_lang_fkey"
            columns: ["preferred_ui_lang"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_residence_region_id_fkey"
            columns: ["residence_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      purposes: {
        Row: {
          id: string
          is_active: boolean
          name_en: string
          name_ja: string
          name_ko: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name_en: string
          name_ja: string
          name_ko: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name_en?: string
          name_ja?: string
          name_ko?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string
          country: Database["public"]["Enums"]["country_t"]
          id: string
          is_active: boolean
          name_en: string
          name_ja: string
          name_ko: string
          sort_order: number
        }
        Insert: {
          code: string
          country: Database["public"]["Enums"]["country_t"]
          id?: string
          is_active?: boolean
          name_en: string
          name_ja: string
          name_ko: string
          sort_order?: number
        }
        Update: {
          code?: string
          country?: Database["public"]["Enums"]["country_t"]
          id?: string
          is_active?: boolean
          name_en?: string
          name_ja?: string
          name_ko?: string
          sort_order?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_note: string | null
          created_at: string
          detail: string | null
          handled_by: string | null
          id: string
          message_id: string | null
          reason: Database["public"]["Enums"]["report_reason_t"]
          reported_user_id: string
          reporter_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status_t"]
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          detail?: string | null
          handled_by?: string | null
          id?: string
          message_id?: string | null
          reason: Database["public"]["Enums"]["report_reason_t"]
          reported_user_id: string
          reporter_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status_t"]
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          detail?: string | null
          handled_by?: string | null
          id?: string
          message_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason_t"]
          reported_user_id?: string
          reporter_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status_t"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          version: string
        }
        Insert: {
          applied_at?: string
          version: string
        }
        Update: {
          applied_at?: string
          version?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status_t"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status: Database["public"]["Enums"]["subscription_status_t"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status_t"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_events_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          interest_id: string
          user_id: string
        }
        Insert: {
          interest_id: string
          user_id: string
        }
        Update: {
          interest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      user_languages: {
        Row: {
          language_code: string
          level: Database["public"]["Enums"]["language_level_t"]
          role: Database["public"]["Enums"]["language_role_t"]
          user_id: string
        }
        Insert: {
          language_code: string
          level: Database["public"]["Enums"]["language_level_t"]
          role: Database["public"]["Enums"]["language_role_t"]
          user_id: string
        }
        Update: {
          language_code?: string
          level?: Database["public"]["Enums"]["language_level_t"]
          role?: Database["public"]["Enums"]["language_role_t"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_languages_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_languages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_languages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      user_purposes: {
        Row: {
          purpose_id: string
          user_id: string
        }
        Insert: {
          purpose_id: string
          user_id: string
        }
        Update: {
          purpose_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purposes_purpose_id_fkey"
            columns: ["purpose_id"]
            isOneToOne: false
            referencedRelation: "purposes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purposes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purposes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      verifications: {
        Row: {
          attempt_count: number
          provider: string
          provider_session_id: string | null
          rejected_reason: string | null
          status: Database["public"]["Enums"]["verification_status_t"]
          submitted_birthdate: string | null
          submitted_name: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_name: string | null
        }
        Insert: {
          attempt_count?: number
          provider?: string
          provider_session_id?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["verification_status_t"]
          submitted_birthdate?: string | null
          submitted_name?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_name?: string | null
        }
        Update: {
          attempt_count?: number
          provider?: string
          provider_session_id?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["verification_status_t"]
          submitted_birthdate?: string | null
          submitted_name?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profile: {
        Row: {
          age: number | null
          bio: string | null
          created_at: string | null
          gender: Database["public"]["Enums"]["gender_t"] | null
          id: string | null
          is_paid: boolean | null
          is_verified: boolean | null
          last_active_at: string | null
          meeting_pref: Database["public"]["Enums"]["meeting_pref_t"] | null
          nationality: Database["public"]["Enums"]["nationality_t"] | null
          nickname: string | null
          occupation: string | null
          primary_photo_path: string | null
          residence_country: Database["public"]["Enums"]["country_t"] | null
          residence_region_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_residence_region_id_fkey"
            columns: ["residence_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_log: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      admin_resolve_report: {
        Args: {
          p_note?: string
          p_report_id: string
          p_status: Database["public"]["Enums"]["report_status_t"]
        }
        Returns: undefined
      }
      admin_role: {
        Args: never
        Returns: Database["public"]["Enums"]["admin_role_t"]
      }
      admin_set_status: {
        Args: {
          p_reason?: string
          p_status: Database["public"]["Enums"]["account_status_t"]
          p_until?: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_verification: {
        Args: {
          p_reason?: string
          p_status: Database["public"]["Enums"]["verification_status_t"]
          p_user_id: string
        }
        Returns: undefined
      }
      apply_invite_code: {
        Args: { p_code: string }
        Returns: Database["public"]["Enums"]["member_tier_t"]
      }
      are_matched: { Args: { a: string; b: string }; Returns: boolean }
      candidate_profiles: {
        Args: never
        Returns: {
          bio: string | null
          birthdate: string | null
          created_at: string
          deleted_at: string | null
          gender: Database["public"]["Enums"]["gender_t"] | null
          id: string
          invite_code_id: string | null
          is_public: boolean
          last_active_at: string | null
          meeting_pref: Database["public"]["Enums"]["meeting_pref_t"] | null
          member_tier: Database["public"]["Enums"]["member_tier_t"]
          nationality: Database["public"]["Enums"]["nationality_t"] | null
          nickname: string | null
          occupation: string | null
          onboarding_completed: boolean
          pref_age_max: number | null
          pref_age_min: number | null
          pref_gender: Database["public"]["Enums"]["gender_t"][] | null
          pref_nationality:
            | Database["public"]["Enums"]["nationality_t"][]
            | null
          preferred_ui_lang: string
          residence_country: Database["public"]["Enums"]["country_t"] | null
          residence_region_id: string | null
          status: Database["public"]["Enums"]["account_status_t"]
          status_reason: string | null
          suspended_until: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_active_member: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_conversation_participant: { Args: { cid: string }; Returns: boolean }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      my_profile: {
        Args: never
        Returns: {
          bio: string | null
          birthdate: string | null
          created_at: string
          deleted_at: string | null
          gender: Database["public"]["Enums"]["gender_t"] | null
          id: string
          invite_code_id: string | null
          is_public: boolean
          last_active_at: string | null
          meeting_pref: Database["public"]["Enums"]["meeting_pref_t"] | null
          member_tier: Database["public"]["Enums"]["member_tier_t"]
          nationality: Database["public"]["Enums"]["nationality_t"] | null
          nickname: string | null
          occupation: string | null
          onboarding_completed: boolean
          pref_age_max: number | null
          pref_age_min: number | null
          pref_gender: Database["public"]["Enums"]["gender_t"][] | null
          pref_nationality:
            | Database["public"]["Enums"]["nationality_t"][]
            | null
          preferred_ui_lang: string
          residence_country: Database["public"]["Enums"]["country_t"] | null
          residence_region_id: string | null
          status: Database["public"]["Enums"]["account_status_t"]
          status_reason: string | null
          suspended_until: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      profile_visible_to_me: { Args: { target: string }; Returns: boolean }
      recommend_users: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          reasons: string[]
          score: number
        }[]
      }
      request_account_deletion: { Args: never; Returns: undefined }
      search_profiles: {
        Args: { filters?: Json; page?: number; size?: number }
        Returns: {
          id: string
          score: number
        }[]
      }
      touch_last_active: { Args: never; Returns: undefined }
      unmatch: { Args: { p_match_id: string }; Returns: undefined }
      validate_invite_code: {
        Args: { p_code: string }
        Returns: {
          grants_tier: Database["public"]["Enums"]["member_tier_t"]
          valid: boolean
        }[]
      }
    }
    Enums: {
      account_status_t: "active" | "suspended" | "banned" | "deleted"
      admin_role_t: "super_admin" | "moderator" | "support"
      country_t: "JP" | "KR" | "other"
      gender_t: "male" | "female" | "other" | "undisclosed"
      language_level_t: "beginner" | "intermediate" | "advanced" | "native"
      language_role_t: "native" | "learning"
      like_status_t: "active" | "withdrawn"
      meeting_pref_t: "online_only" | "online_first" | "meet_ok" | "travel_meet"
      member_tier_t: "free" | "paid" | "invited"
      nationality_t: "JP" | "KR" | "other"
      notification_type_t:
        | "like"
        | "match"
        | "message"
        | "verification"
        | "system"
        | "announcement"
      report_reason_t:
        | "inappropriate_content"
        | "impersonation"
        | "harassment"
        | "fraud_suspected"
        | "inappropriate_photo"
        | "other"
      report_status_t: "open" | "in_review" | "resolved" | "dismissed"
      subscription_status_t:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      verification_status_t: "unverified" | "pending" | "verified" | "rejected"
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
      account_status_t: ["active", "suspended", "banned", "deleted"],
      admin_role_t: ["super_admin", "moderator", "support"],
      country_t: ["JP", "KR", "other"],
      gender_t: ["male", "female", "other", "undisclosed"],
      language_level_t: ["beginner", "intermediate", "advanced", "native"],
      language_role_t: ["native", "learning"],
      like_status_t: ["active", "withdrawn"],
      meeting_pref_t: ["online_only", "online_first", "meet_ok", "travel_meet"],
      member_tier_t: ["free", "paid", "invited"],
      nationality_t: ["JP", "KR", "other"],
      notification_type_t: [
        "like",
        "match",
        "message",
        "verification",
        "system",
        "announcement",
      ],
      report_reason_t: [
        "inappropriate_content",
        "impersonation",
        "harassment",
        "fraud_suspected",
        "inappropriate_photo",
        "other",
      ],
      report_status_t: ["open", "in_review", "resolved", "dismissed"],
      subscription_status_t: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      verification_status_t: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
