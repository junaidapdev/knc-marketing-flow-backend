/**
 * Database types for the Kayan Marketing Flow schema.
 *
 * This file mirrors the shape produced by:
 *   npx supabase gen types typescript --project-id <ref> --schema public
 *
 * When the live Supabase project is reachable, regenerate with:
 *   npm run db:types
 * which overwrites this file with the authoritative output.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      brand: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          is_hidden: boolean;
          accent_color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          is_hidden?: boolean;
          accent_color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          is_hidden?: boolean;
          accent_color?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      branch: {
        Row: {
          id: string;
          name: string;
          city: string;
          brand_id: string;
          has_boxed_chocolates: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          brand_id: string;
          has_boxed_chocolates?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string;
          brand_id?: string;
          has_boxed_chocolates?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'branch_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand';
            referencedColumns: ['id'];
          },
        ];
      };
      assignee: {
        Row: {
          id: string;
          name: string;
          role: 'content_engagement' | 'digital_marketing_production';
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          role: 'content_engagement' | 'digital_marketing_production';
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: 'content_engagement' | 'digital_marketing_production';
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      plan: {
        Row: {
          id: string;
          month: number;
          year: number;
          budget_ceiling: number | null;
          status: 'draft' | 'published';
          wizard_draft: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          month: number;
          year: number;
          budget_ceiling?: number | null;
          status?: 'draft' | 'published';
          wizard_draft?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          month?: number;
          year?: number;
          budget_ceiling?: number | null;
          status?: 'draft' | 'published';
          wizard_draft?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      recurring_template: {
        Row: {
          id: string;
          name: string;
          brand_id: string;
          content_type: string;
          cadence: 'daily' | 'weekly' | 'monthly' | 'custom';
          days_of_week: number[] | null;
          default_assignee_id: string;
          shoot_mode: 'shoot_daily' | 'shoot_weekly_post_daily' | 'none' | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand_id: string;
          content_type: string;
          cadence: 'daily' | 'weekly' | 'monthly' | 'custom';
          days_of_week?: number[] | null;
          default_assignee_id: string;
          shoot_mode?: 'shoot_daily' | 'shoot_weekly_post_daily' | 'none' | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          brand_id?: string;
          content_type?: string;
          cadence?: 'daily' | 'weekly' | 'monthly' | 'custom';
          days_of_week?: number[] | null;
          default_assignee_id?: string;
          shoot_mode?: 'shoot_daily' | 'shoot_weekly_post_daily' | 'none' | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recurring_template_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_template_default_assignee_id_fkey';
            columns: ['default_assignee_id'];
            isOneToOne: false;
            referencedRelation: 'assignee';
            referencedColumns: ['id'];
          },
        ];
      };
      calendar_entry: {
        Row: {
          id: string;
          plan_id: string;
          brand_id: string;
          date: string;
          type:
            | 'snap_story'
            | 'snap_spotlight'
            | 'tiktok_video'
            | 'ig_video'
            | 'ig_story'
            | 'shop_activity'
            | 'offer'
            | 'shoot'
            | 'engagement'
            | 'research';
          platform: string | null;
          title: string;
          script: string | null;
          notes: string | null;
          status: 'planned' | 'in_progress' | 'ready' | 'posted';
          template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          brand_id: string;
          date: string;
          type:
            | 'snap_story'
            | 'snap_spotlight'
            | 'tiktok_video'
            | 'ig_video'
            | 'ig_story'
            | 'shop_activity'
            | 'offer'
            | 'shoot'
            | 'engagement'
            | 'research';
          platform?: string | null;
          title: string;
          script?: string | null;
          notes?: string | null;
          status?: 'planned' | 'in_progress' | 'ready' | 'posted';
          template_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          brand_id?: string;
          date?: string;
          type?:
            | 'snap_story'
            | 'snap_spotlight'
            | 'tiktok_video'
            | 'ig_video'
            | 'ig_story'
            | 'shop_activity'
            | 'offer'
            | 'shoot'
            | 'engagement'
            | 'research';
          platform?: string | null;
          title?: string;
          script?: string | null;
          notes?: string | null;
          status?: 'planned' | 'in_progress' | 'ready' | 'posted';
          template_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calendar_entry_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plan';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calendar_entry_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calendar_entry_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'recurring_template';
            referencedColumns: ['id'];
          },
        ];
      };
      shop_activity: {
        Row: {
          id: string;
          plan_id: string;
          branch_id: string;
          week_of: string;
          type: 'sampling' | 'display_change' | 'tasting' | 'promotion_setup' | 'other';
          assignee_id: string;
          status: 'planned' | 'in_progress' | 'completed';
          photo_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          branch_id: string;
          week_of: string;
          type: 'sampling' | 'display_change' | 'tasting' | 'promotion_setup' | 'other';
          assignee_id: string;
          status?: 'planned' | 'in_progress' | 'completed';
          photo_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          branch_id?: string;
          week_of?: string;
          type?: 'sampling' | 'display_change' | 'tasting' | 'promotion_setup' | 'other';
          assignee_id?: string;
          status?: 'planned' | 'in_progress' | 'completed';
          photo_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shop_activity_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plan';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shop_activity_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branch';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shop_activity_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'assignee';
            referencedColumns: ['id'];
          },
        ];
      };
      offer: {
        Row: {
          id: string;
          plan_id: string;
          brand_id: string;
          name: string;
          type: 'threshold_coupon' | 'branch_deal' | 'single_product' | 'salary_week' | 'bundle';
          branch_ids: string[];
          start_date: string;
          end_date: string;
          products_text: string | null;
          mechanic_text: string | null;
          budget_amount: number | null;
          assignee_id: string;
          status: 'planned' | 'live' | 'ended';
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          brand_id: string;
          name: string;
          type: 'threshold_coupon' | 'branch_deal' | 'single_product' | 'salary_week' | 'bundle';
          branch_ids: string[];
          start_date: string;
          end_date: string;
          products_text?: string | null;
          mechanic_text?: string | null;
          budget_amount?: number | null;
          assignee_id: string;
          status?: 'planned' | 'live' | 'ended';
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          brand_id?: string;
          name?: string;
          type?: 'threshold_coupon' | 'branch_deal' | 'single_product' | 'salary_week' | 'bundle';
          branch_ids?: string[];
          start_date?: string;
          end_date?: string;
          products_text?: string | null;
          mechanic_text?: string | null;
          budget_amount?: number | null;
          assignee_id?: string;
          status?: 'planned' | 'live' | 'ended';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'offer_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plan';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offer_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offer_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'assignee';
            referencedColumns: ['id'];
          },
        ];
      };
      task: {
        Row: {
          id: string;
          calendar_entry_id: string | null;
          offer_id: string | null;
          shop_activity_id: string | null;
          assignee_id: string;
          due_date: string;
          step: 'script' | 'shoot' | 'edit' | 'post' | 'setup' | 'execute';
          status: 'pending' | 'in_progress' | 'done' | 'skipped';
          notes: string | null;
          shared_shoot_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          calendar_entry_id?: string | null;
          offer_id?: string | null;
          shop_activity_id?: string | null;
          assignee_id: string;
          due_date: string;
          step: 'script' | 'shoot' | 'edit' | 'post' | 'setup' | 'execute';
          status?: 'pending' | 'in_progress' | 'done' | 'skipped';
          notes?: string | null;
          shared_shoot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          calendar_entry_id?: string | null;
          offer_id?: string | null;
          shop_activity_id?: string | null;
          assignee_id?: string;
          due_date?: string;
          step?: 'script' | 'shoot' | 'edit' | 'post' | 'setup' | 'execute';
          status?: 'pending' | 'in_progress' | 'done' | 'skipped';
          notes?: string | null;
          shared_shoot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_calendar_entry_id_fkey';
            columns: ['calendar_entry_id'];
            isOneToOne: false;
            referencedRelation: 'calendar_entry';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'offer';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_shop_activity_id_fkey';
            columns: ['shop_activity_id'];
            isOneToOne: false;
            referencedRelation: 'shop_activity';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'assignee';
            referencedColumns: ['id'];
          },
        ];
      };
      budget_entry: {
        Row: {
          id: string;
          plan_id: string;
          category:
            | 'general_marketing'
            | 'influencers'
            | 'in_shop_activities'
            | 'product_offers'
            | 'camera_production';
          amount_sar: number;
          date: string;
          description: string | null;
          branch_id: string | null;
          linked_entity_type: 'calendar_entry' | 'offer' | 'shop_activity' | null;
          linked_entity_id: string | null;
          receipt_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          category:
            | 'general_marketing'
            | 'influencers'
            | 'in_shop_activities'
            | 'product_offers'
            | 'camera_production';
          amount_sar: number;
          date: string;
          description?: string | null;
          branch_id?: string | null;
          linked_entity_type?: 'calendar_entry' | 'offer' | 'shop_activity' | null;
          linked_entity_id?: string | null;
          receipt_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          category?:
            | 'general_marketing'
            | 'influencers'
            | 'in_shop_activities'
            | 'product_offers'
            | 'camera_production';
          amount_sar?: number;
          date?: string;
          description?: string | null;
          branch_id?: string | null;
          linked_entity_type?: 'calendar_entry' | 'offer' | 'shop_activity' | null;
          linked_entity_id?: string | null;
          receipt_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_entry_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plan';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_entry_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branch';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settings: {
        Row: {
          user_id: string;
          claude_api_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          claude_api_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          claude_api_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      social_account: {
        Row: {
          id: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          handle: string;
          brand_id: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          handle: string;
          brand_id: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: 'tiktok' | 'instagram' | 'snapchat';
          handle?: string;
          brand_id?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      social_snapshots: {
        Row: {
          id: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          brand_id: string;
          captured_at: string;
          followers: number | null;
          total_likes: number | null;
          total_videos: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          brand_id: string;
          captured_at?: string;
          followers?: number | null;
          total_likes?: number | null;
          total_videos?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: 'tiktok' | 'instagram' | 'snapchat';
          brand_id?: string;
          captured_at?: string;
          followers?: number | null;
          total_likes?: number | null;
          total_videos?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      social_posts: {
        Row: {
          id: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          brand_id: string;
          external_id: string;
          url: string | null;
          caption: string | null;
          posted_at: string | null;
          duration_seconds: number | null;
          plays: number | null;
          likes: number | null;
          comments: number | null;
          shares: number | null;
          saves: number | null;
          hashtags: string[];
          thumbnail_url: string | null;
          last_synced_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          brand_id: string;
          external_id: string;
          url?: string | null;
          caption?: string | null;
          posted_at?: string | null;
          duration_seconds?: number | null;
          plays?: number | null;
          likes?: number | null;
          comments?: number | null;
          shares?: number | null;
          saves?: number | null;
          hashtags?: string[];
          thumbnail_url?: string | null;
          last_synced_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: 'tiktok' | 'instagram' | 'snapchat';
          brand_id?: string;
          external_id?: string;
          url?: string | null;
          caption?: string | null;
          posted_at?: string | null;
          duration_seconds?: number | null;
          plays?: number | null;
          likes?: number | null;
          comments?: number | null;
          shares?: number | null;
          saves?: number | null;
          hashtags?: string[];
          thumbnail_url?: string | null;
          last_synced_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      social_sync_log: {
        Row: {
          id: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          triggered_by: string | null;
          started_at: string;
          finished_at: string | null;
          status: 'running' | 'success' | 'failed';
          posts_upserted: number;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: 'tiktok' | 'instagram' | 'snapchat';
          triggered_by?: string | null;
          started_at?: string;
          finished_at?: string | null;
          status: 'running' | 'success' | 'failed';
          posts_upserted?: number;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: 'tiktok' | 'instagram' | 'snapchat';
          triggered_by?: string | null;
          started_at?: string;
          finished_at?: string | null;
          status?: 'running' | 'success' | 'failed';
          posts_upserted?: number;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_plan_with_entries: {
        Args: {
          p_month: number;
          p_year: number;
          p_budget_ceiling: number | null;
          p_entries: Json;
        };
        Returns: string;
      };
      create_entry_with_tasks: {
        Args: {
          p_entry: Json;
          p_tasks: Json;
        };
        Returns: Json;
      };
      apply_templates_to_plan: {
        Args: {
          p_plan_id: string;
          p_shared_shoots: Json;
          p_entries: Json;
        };
        Returns: Json;
      };
      create_offer_with_task: {
        Args: {
          p_offer: Json;
          p_task: Json;
        };
        Returns: Json;
      };
      create_shop_activity_with_task: {
        Args: {
          p_activity: Json;
          p_task: Json;
        };
        Returns: Json;
      };
      create_plan_from_wizard: {
        Args: {
          p_plan: Json;
          p_shared_shoots: Json;
          p_entries: Json;
          p_offers: Json;
          p_shop_activities: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type PublicSchema = Database['public'];

export type TableRow<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TableInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
