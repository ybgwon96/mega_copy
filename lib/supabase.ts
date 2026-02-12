import { createClient } from '@supabase/supabase-js';

// Cloudflare Pages 빌드를 위한 기본값 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nzmscqfrmxqcukhshsok.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56bXNjcWZybXhxY3VraHNoc29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMTg1NDMsImV4cCI6MjA3MTc5NDU0M30.o0zQtPEjsuJnfQnY2MiakuM2EvTlVuRO9yeoajrwiLU';

// Singleton 패턴으로 Supabase 클라이언트 생성 (중복 인스턴스 방지)
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
})();

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          brand: string;
          price: number;
          category: string;
          description: string | null;
          stock: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand: string;
          price: number;
          category: string;
          description?: string | null;
          stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          brand?: string;
          price?: number;
          category?: string;
          description?: string | null;
          stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          image_url: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          image_url: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          image_url?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      notices: {
        Row: {
          id: string;
          content: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      admins: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          password_hash?: string;
          role?: string;
          created_at?: string;
        };
      };
    };
  };
};