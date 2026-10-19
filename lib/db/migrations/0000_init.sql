CREATE TYPE "public"."competition_status" AS ENUM('draft', 'prepared', 'warmup', 'round1', 'break', 'round2', 'shootoff', 'finished', 'published');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('reverse_ranking', 'random', 'manual');--> statement-breakpoint
CREATE TYPE "public"."rank_reason" AS ENUM('start', 'junior', 'promotion', 'junior_age_out', 'manual');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"season_year" integer NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"location" text,
	"status" "competition_status" DEFAULT 'draft' NOT NULL,
	"rounds" integer DEFAULT 2 NOT NULL,
	"knockdowns" integer DEFAULT 2 NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"counts_for_season" boolean DEFAULT true NOT NULL,
	"setup_by_rank" jsonb NOT NULL,
	"operator_device_id" text,
	"operator_lease_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"shooter_id" uuid NOT NULL,
	"rank_code" text NOT NULL,
	"checked_in_at" timestamp with time zone NOT NULL,
	"fee_paid" boolean DEFAULT false NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"withdrawn" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"client_created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"knockdown" integer NOT NULL,
	"hits" jsonb NOT NULL,
	"score" integer NOT NULL,
	"entered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranks" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"is_junior" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"year" integer PRIMARY KEY NOT NULL,
	"status" "season_status" DEFAULT 'open' NOT NULL,
	"ranking_rule" jsonb DEFAULT '{"type":"sum"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "setups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shooter_season_ranks" (
	"shooter_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"rank_code" text NOT NULL,
	"reason" "rank_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shooter_season_ranks_shooter_id_season_year_pk" PRIMARY KEY("shooter_id","season_year")
);
--> statement-breakpoint
CREATE TABLE "shooters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birthdate" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shootoff_iterations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"rank_code" text NOT NULL,
	"seq" integer NOT NULL,
	"participants" jsonb NOT NULL,
	"calls" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "start_orders" (
	"competition_id" uuid NOT NULL,
	"rank_code" text NOT NULL,
	"entry_ids" jsonb NOT NULL,
	"source" "order_source" NOT NULL,
	"seed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "start_orders_competition_id_rank_code_pk" PRIMARY KEY("competition_id","rank_code")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'operator' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_year_seasons_year_fk" FOREIGN KEY ("season_year") REFERENCES "public"."seasons"("year") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "public"."shooters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_rank_code_ranks_code_fk" FOREIGN KEY ("rank_code") REFERENCES "public"."ranks"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shooter_season_ranks" ADD CONSTRAINT "shooter_season_ranks_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "public"."shooters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shooter_season_ranks" ADD CONSTRAINT "shooter_season_ranks_season_year_seasons_year_fk" FOREIGN KEY ("season_year") REFERENCES "public"."seasons"("year") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shooter_season_ranks" ADD CONSTRAINT "shooter_season_ranks_rank_code_ranks_code_fk" FOREIGN KEY ("rank_code") REFERENCES "public"."ranks"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shootoff_iterations" ADD CONSTRAINT "shootoff_iterations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shootoff_iterations" ADD CONSTRAINT "shootoff_iterations_rank_code_ranks_code_fk" FOREIGN KEY ("rank_code") REFERENCES "public"."ranks"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_orders" ADD CONSTRAINT "start_orders_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_orders" ADD CONSTRAINT "start_orders_rank_code_ranks_code_fk" FOREIGN KEY ("rank_code") REFERENCES "public"."ranks"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_slug_idx" ON "competitions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "competitions_season_idx" ON "competitions" USING btree ("season_year");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_comp_shooter_idx" ON "entries" USING btree ("competition_id","shooter_id");--> statement-breakpoint
CREATE INDEX "events_competition_idx" ON "events" USING btree ("competition_id","client_created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "passes_entry_round_kd_idx" ON "passes" USING btree ("entry_id","round","knockdown");--> statement-breakpoint
CREATE INDEX "passes_competition_idx" ON "passes" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shooters_name_idx" ON "shooters" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "shootoffs_competition_idx" ON "shootoff_iterations" USING btree ("competition_id","rank_code");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");