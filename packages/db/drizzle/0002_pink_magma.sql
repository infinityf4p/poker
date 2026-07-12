CREATE TYPE "public"."membership_status" AS ENUM('ACTIVE', 'KICK_PENDING', 'KICKED');--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"login_enabled" boolean DEFAULT true NOT NULL,
	"linked_admin_id" uuid,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_accounts_username_unique" UNIQUE("username"),
	CONSTRAINT "user_accounts_linked_admin_id_unique" UNIQUE("linked_admin_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "player_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "membership_status" "membership_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "kicked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "kicked_by_admin_id" uuid;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "kick_reason" text;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_linked_admin_id_admins_id_fk" FOREIGN KEY ("linked_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_user_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_idx" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_user_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_kicked_by_admin_id_admins_id_fk" FOREIGN KEY ("kicked_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_room_user_idx" ON "players" USING btree ("room_id","user_id");--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "recovery_hash";