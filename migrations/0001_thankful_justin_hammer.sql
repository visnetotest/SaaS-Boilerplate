CREATE TABLE IF NOT EXISTS "analytics_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"session_id" varchar(255),
	"event_name" varchar(100) NOT NULL,
	"category" varchar(100),
	"properties" jsonb,
	"url" varchar(1000),
	"referrer" varchar(1000),
	"user_agent" text,
	"ip_address" varchar(45),
	"value" integer,
	"currency" varchar(3),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"details" jsonb,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"version" varchar(50) NOT NULL,
	"description" text,
	"author" varchar(255),
	"repository" varchar(500),
	"homepage" varchar(500),
	"category" varchar(100),
	"tags" jsonb,
	"dependencies" jsonb,
	"status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"is_system" boolean DEFAULT false,
	"manifest" jsonb,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb,
	"description" text,
	"category" varchar(100),
	"is_public" boolean DEFAULT false,
	"is_encrypted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_plugin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'installed' NOT NULL,
	"version" varchar(50) NOT NULL,
	"config" jsonb,
	"settings" jsonb,
	"installed_by" uuid,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"domain" varchar(255),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"settings" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"avatar" varchar(500),
	"password_hash" varchar(255),
	"email_verified" boolean DEFAULT false,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"external_id" varchar(255),
	"provider" varchar(50),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"locale" varchar(10) DEFAULT 'en',
	"timezone" varchar(50) DEFAULT 'UTC',
	"preferences" jsonb,
	"metadata" jsonb,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "stripe_customer_id_idx";--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tenant_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "logo" varchar(500);--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "website" varchar(500);--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "settings" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role" ADD CONSTRAINT "role_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_plugin" ADD CONSTRAINT "tenant_plugin_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_plugin" ADD CONSTRAINT "tenant_plugin_plugin_id_plugin_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugin"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_plugin" ADD CONSTRAINT "tenant_plugin_installed_by_user_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role" ADD CONSTRAINT "user_role_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_event_tenant_id_idx" ON "analytics_event" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_event_user_id_idx" ON "analytics_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_event_event_name_idx" ON "analytics_event" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_event_category_idx" ON "analytics_event" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_event_timestamp_idx" ON "analytics_event" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_tenant_id_idx" ON "audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_resource_type_idx" ON "audit_log" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plugin_slug_idx" ON "plugin" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_status_idx" ON "plugin" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_category_idx" ON "plugin" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_tenant_id_idx" ON "role" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_tenant_name_idx" ON "role" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_config_key_idx" ON "system_config" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_config_category_idx" ON "system_config" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_plugin_tenant_id_idx" ON "tenant_plugin" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_plugin_plugin_id_idx" ON "tenant_plugin" USING btree ("plugin_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_plugin_tenant_plugin_idx" ON "tenant_plugin" USING btree ("tenant_id","plugin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_plugin_status_idx" ON "tenant_plugin" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_slug_idx" ON "tenant" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_status_idx" ON "tenant" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_user_id_idx" ON "user_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_role_id_idx" ON "user_role" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_role_user_role_idx" ON "user_role" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tenant_id_idx" ON "user" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_organization_id_idx" ON "user" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_external_id_idx" ON "user" USING btree ("external_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_status_idx" ON "user" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization" ADD CONSTRAINT "organization_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_tenant_id_idx" ON "organization" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_stripe_customer_id_idx" ON "organization" USING btree ("stripe_customer_id");