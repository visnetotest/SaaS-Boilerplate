CREATE TABLE IF NOT EXISTS "api_gateway" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"path" varchar(500) NOT NULL,
	"method" varchar(10) NOT NULL,
	"target_service_id" uuid NOT NULL,
	"rate_limit" integer,
	"burst_limit" integer,
	"requires_auth" boolean DEFAULT true,
	"allowed_roles" jsonb,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"description" text,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_gateway_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "error_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"service_id" uuid,
	"error_type" varchar(100) NOT NULL,
	"error_message" text NOT NULL,
	"stack_trace" text,
	"endpoint" varchar(500),
	"method" varchar(10),
	"user_agent" text,
	"ip_address" varchar(45),
	"severity" varchar(20) DEFAULT 'error' NOT NULL,
	"context" jsonb,
	"tags" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"service_id" uuid,
	"metric_name" varchar(100) NOT NULL,
	"metric_type" varchar(50) NOT NULL,
	"value" bigint NOT NULL,
	"unit" varchar(20),
	"endpoint" varchar(500),
	"user_id" uuid,
	"session_id" varchar(255),
	"tags" jsonb,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"version" varchar(50) NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"health_endpoint" varchar(500),
	"docs_endpoint" varchar(500),
	"description" text,
	"category" varchar(100),
	"tags" jsonb,
	"status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"is_internal" boolean DEFAULT false,
	"last_health_check" timestamp,
	"response_time" integer,
	"uptime" integer,
	"config" jsonb,
	"secrets" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_registry_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_execution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"triggered_by" varchar(100),
	"triggered_by_id" uuid,
	"status" varchar(50) DEFAULT 'running' NOT NULL,
	"current_step" varchar(255),
	"progress" integer DEFAULT 0,
	"result" jsonb,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration" integer,
	"context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"definition" jsonb NOT NULL,
	"triggers" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"version" varchar(50) DEFAULT '1.0.0' NOT NULL,
	"settings" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_gateway" ADD CONSTRAINT "api_gateway_target_service_id_service_registry_id_fk" FOREIGN KEY ("target_service_id") REFERENCES "public"."service_registry"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "error_tracking" ADD CONSTRAINT "error_tracking_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "error_tracking" ADD CONSTRAINT "error_tracking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "error_tracking" ADD CONSTRAINT "error_tracking_service_id_service_registry_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service_registry"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_service_id_service_registry_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service_registry"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_execution" ADD CONSTRAINT "workflow_execution_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_execution" ADD CONSTRAINT "workflow_execution_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_execution" ADD CONSTRAINT "workflow_execution_triggered_by_id_user_id_fk" FOREIGN KEY ("triggered_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow" ADD CONSTRAINT "workflow_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow" ADD CONSTRAINT "workflow_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow" ADD CONSTRAINT "workflow_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_gateway_slug_idx" ON "api_gateway" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_gateway_target_service_id_idx" ON "api_gateway" USING btree ("target_service_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_gateway_path_method_idx" ON "api_gateway" USING btree ("path","method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_gateway_status_idx" ON "api_gateway" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_tracking_tenant_id_idx" ON "error_tracking" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_tracking_user_id_idx" ON "error_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_tracking_service_id_idx" ON "error_tracking" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_tracking_error_type_idx" ON "error_tracking" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_tracking_severity_idx" ON "error_tracking" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_tracking_timestamp_idx" ON "error_tracking" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performance_metrics_tenant_id_idx" ON "performance_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performance_metrics_service_id_idx" ON "performance_metrics" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performance_metrics_metric_name_idx" ON "performance_metrics" USING btree ("metric_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performance_metrics_timestamp_idx" ON "performance_metrics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performance_metrics_metric_type_idx" ON "performance_metrics" USING btree ("metric_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "service_registry_slug_idx" ON "service_registry" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_registry_status_idx" ON "service_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_registry_category_idx" ON "service_registry" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_execution_workflow_id_idx" ON "workflow_execution" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_execution_tenant_id_idx" ON "workflow_execution" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_execution_status_idx" ON "workflow_execution" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_execution_started_at_idx" ON "workflow_execution" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_execution_triggered_by_id_idx" ON "workflow_execution" USING btree ("triggered_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_tenant_id_idx" ON "workflow" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_status_idx" ON "workflow" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_category_idx" ON "workflow" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_created_by_idx" ON "workflow" USING btree ("created_by");