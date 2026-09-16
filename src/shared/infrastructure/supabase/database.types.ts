/**
 * Minimal hand-written stand-in for `supabase gen types typescript`.
 *
 * Regenerate with:
 *   supabase gen types typescript --local > src/shared/infrastructure/supabase/database.types.ts
 *
 * Deliberately not `server-only`: the browser client is typed with it too.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          done: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todos_user_id_users_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TodoRowDto = Database["public"]["Tables"]["todos"]["Row"];
