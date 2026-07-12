CREATE TYPE "public"."hand_phase" AS ENUM('POST_BLINDS', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'SETTLED');--> statement-breakpoint
CREATE TYPE "public"."room_mode" AS ENUM('ONLINE', 'LIVE');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('LOBBY', 'ACTIVE', 'BETWEEN_HANDS', 'DISPUTED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"room_id" uuid,
	"action" text NOT NULL,
	"ip" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_results" (
	"room_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_results_room_id_command_id_pk" PRIMARY KEY("room_id","command_id")
);
--> statement-breakpoint
CREATE TABLE "hands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"hand_number" integer NOT NULL,
	"mode" "room_mode" NOT NULL,
	"phase" "hand_phase" DEFAULT 'POST_BLINDS' NOT NULL,
	"button_seat" integer NOT NULL,
	"initial_total_chips" bigint NOT NULL,
	"result" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"hand_id" uuid,
	"seq" bigint NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"delta" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_result_confirmations" (
	"proposal_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_result_confirmations_proposal_id_player_id_kind_pk" PRIMARY KEY("proposal_id","player_id","kind")
);
--> statement-breakpoint
CREATE TABLE "live_result_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"hand_id" uuid NOT NULL,
	"proposer_player_id" uuid NOT NULL,
	"winners_by_pot" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"settle_at" timestamp with time zone NOT NULL,
	"dispute_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"recovery_hash" text NOT NULL,
	"stack" bigint NOT NULL,
	"seat" integer,
	"ready" boolean DEFAULT false NOT NULL,
	"sitting_out" boolean DEFAULT false NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_seat_range" CHECK ("players"."seat" is null or ("players"."seat" >= 0 and "players"."seat" <= 5)),
	CONSTRAINT "players_stack_nonnegative" CHECK ("players"."stack" >= 0)
);
--> statement-breakpoint
CREATE TABLE "private_snapshots" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"ciphertext" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"hand_id" uuid,
	"seq" bigint NOT NULL,
	"type" text NOT NULL,
	"actor_player_id" uuid,
	"public_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mode" "room_mode" NOT NULL,
	"status" "room_status" DEFAULT 'LOBBY' NOT NULL,
	"settings" jsonb NOT NULL,
	"settings_locked" boolean DEFAULT false NOT NULL,
	"server_seq" bigint DEFAULT 0 NOT NULL,
	"hand_number" integer DEFAULT 0 NOT NULL,
	"public_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_online_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"created_by_admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_results" ADD CONSTRAINT "command_results_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_results" ADD CONSTRAINT "command_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_result_confirmations" ADD CONSTRAINT "live_result_confirmations_proposal_id_live_result_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."live_result_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_result_confirmations" ADD CONSTRAINT "live_result_confirmations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_result_proposals" ADD CONSTRAINT "live_result_proposals_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_result_proposals" ADD CONSTRAINT "live_result_proposals_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_result_proposals" ADD CONSTRAINT "live_result_proposals_proposer_player_id_players_id_fk" FOREIGN KEY ("proposer_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_snapshots" ADD CONSTRAINT "private_snapshots_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_events" ADD CONSTRAINT "room_events_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_events" ADD CONSTRAINT "room_events_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_events" ADD CONSTRAINT "room_events_actor_player_id_players_id_fk" FOREIGN KEY ("actor_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_invites" ADD CONSTRAINT "room_invites_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_idx" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "audit_logs_retention_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "command_results_retention_idx" ON "command_results" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hands_room_number_idx" ON "hands" USING btree ("room_id","hand_number");--> statement-breakpoint
CREATE INDEX "hands_retention_idx" ON "hands" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "ledger_room_seq_idx" ON "ledger_entries" USING btree ("room_id","seq");--> statement-breakpoint
CREATE INDEX "ledger_hand_idx" ON "ledger_entries" USING btree ("hand_id");--> statement-breakpoint
CREATE INDEX "live_proposals_room_status_idx" ON "live_result_proposals" USING btree ("room_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "player_sessions_token_hash_idx" ON "player_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "players_room_seat_idx" ON "players" USING btree ("room_id","seat") WHERE "players"."seat" is not null;--> statement-breakpoint
CREATE INDEX "players_room_idx" ON "players" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_events_room_seq_idx" ON "room_events" USING btree ("room_id","seq");--> statement-breakpoint
CREATE INDEX "room_events_hand_idx" ON "room_events" USING btree ("hand_id");--> statement-breakpoint
CREATE INDEX "room_events_retention_idx" ON "room_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "room_invites_token_hash_idx" ON "room_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "rooms_status_updated_idx" ON "rooms" USING btree ("status","updated_at");