-- Tables and columns created by hand in Supabase (src/lib/migrations/*.sql).
-- Brings the Drizzle migrations to the real schema, for a fresh database (Neon, tests).
-- Never run against the existing Supabase database: these objects already exist there.
CREATE TABLE "household_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"code_used" varchar(8) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	CONSTRAINT "household_join_requests_status_check" CHECK ("household_join_requests"."status" IN ('pending', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "monthly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_reports_household_id_month_key" UNIQUE("household_id","month")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pseudo" varchar(30) NOT NULL,
	"description" varchar(80),
	"avatar_color" varchar(7) DEFAULT '#4A7C59' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "join_code" varchar(8) NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "join_code_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "join_code_updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "household_join_requests" ADD CONSTRAINT "household_join_requests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_one_pending_per_user_household" ON "household_join_requests" USING btree ("household_id","requester_user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "idx_join_requests_household" ON "household_join_requests" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_join_requests_requester" ON "household_join_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_profiles_pseudo" ON "user_profiles" USING btree ("pseudo");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_households_join_code" ON "households" USING btree ("join_code");--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON "user_profiles"
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();
