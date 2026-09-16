CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_owner_created_idx" ON "todos" USING btree ("user_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "todos_owner_updated_idx" ON "todos" USING btree ("user_id","updated_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "todos_owner_title_idx" ON "todos" USING btree ("user_id","title","id");--> statement-breakpoint
CREATE POLICY "todos_select_own" ON "todos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "todos"."user_id");--> statement-breakpoint
CREATE POLICY "todos_insert_own" ON "todos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "todos"."user_id");--> statement-breakpoint
CREATE POLICY "todos_update_own" ON "todos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "todos"."user_id") WITH CHECK ((select auth.uid()) = "todos"."user_id");--> statement-breakpoint
CREATE POLICY "todos_delete_own" ON "todos" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "todos"."user_id");