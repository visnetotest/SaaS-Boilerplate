CREATE TABLE "workflow_edge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"edge_id" varchar(255) NOT NULL,
	"source_node_id" varchar(255) NOT NULL,
	"target_node_id" varchar(255) NOT NULL,
	"source_handle" varchar(100),
	"target_handle" varchar(100),
	"condition" jsonb,
	"label" varchar(255),
	"data" jsonb,
	"type" varchar(50) DEFAULT 'default',
	"animated" boolean DEFAULT false,
	"style" jsonb,
	"is_enabled" boolean DEFAULT true,
	"is_optional" boolean DEFAULT false,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_execution_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"step_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration" integer,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"error_details" jsonb,
	"context" jsonb,
	"metadata" jsonb,
	"attempt_count" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"node_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"category" varchar(100),
	"config" jsonb NOT NULL,
	"parameters" jsonb,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"position_x" integer DEFAULT 0,
	"position_y" integer DEFAULT 0,
	"timeout" integer DEFAULT 300,
	"retry_policy" jsonb,
	"error_handling" jsonb,
	"is_enabled" boolean DEFAULT true,
	"is_optional" boolean DEFAULT false,
	"description" text,
	"tags" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"tags" jsonb,
	"definition" jsonb NOT NULL,
	"variables" jsonb,
	"author" varchar(255),
	"version" varchar(50) DEFAULT '1.0.0',
	"is_public" boolean DEFAULT false,
	"is_system" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"rating" integer,
	"downloads" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_deprecated" boolean DEFAULT false,
	"metadata" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_trigger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"event_type" varchar(100),
	"config" jsonb NOT NULL,
	"conditions" jsonb,
	"schedule" varchar(255),
	"timezone" varchar(50) DEFAULT 'UTC',
	"start_date" timestamp,
	"end_date" timestamp,
	"webhook_endpoint" varchar(500),
	"webhook_secret" varchar(255),
	"is_active" boolean DEFAULT true,
	"last_triggered_at" timestamp,
	"trigger_count" integer DEFAULT 0,
	"debounce" integer,
	"timeout" integer DEFAULT 3600,
	"retry_policy" jsonb,
	"error_handling" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_variable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"scope" varchar(50) DEFAULT 'workflow',
	"default_value" jsonb,
	"description" text,
	"is_required" boolean DEFAULT false,
	"is_secret" boolean DEFAULT false,
	"validation_schema" jsonb,
	"allowed_values" jsonb,
	"category" varchar(100),
	"tags" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD COLUMN "trigger_data" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD COLUMN "error_details" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edge" ADD CONSTRAINT "workflow_edge_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_step" ADD CONSTRAINT "workflow_execution_step_execution_id_workflow_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_step" ADD CONSTRAINT "workflow_execution_step_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_step" ADD CONSTRAINT "workflow_execution_step_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_node" ADD CONSTRAINT "workflow_node_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_node" ADD CONSTRAINT "workflow_node_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_node" ADD CONSTRAINT "workflow_node_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_node" ADD CONSTRAINT "workflow_node_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template" ADD CONSTRAINT "workflow_template_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template" ADD CONSTRAINT "workflow_template_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template" ADD CONSTRAINT "workflow_template_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_trigger" ADD CONSTRAINT "workflow_trigger_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_trigger" ADD CONSTRAINT "workflow_trigger_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_trigger" ADD CONSTRAINT "workflow_trigger_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_trigger" ADD CONSTRAINT "workflow_trigger_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_variable" ADD CONSTRAINT "workflow_variable_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_variable" ADD CONSTRAINT "workflow_variable_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_variable" ADD CONSTRAINT "workflow_variable_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_variable" ADD CONSTRAINT "workflow_variable_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_edge_workflow_id_idx" ON "workflow_edge" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_edge_tenant_id_idx" ON "workflow_edge" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_edge_edge_id_idx" ON "workflow_edge" USING btree ("edge_id");--> statement-breakpoint
CREATE INDEX "workflow_edge_source_node_id_idx" ON "workflow_edge" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "workflow_edge_target_node_id_idx" ON "workflow_edge" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "workflow_edge_is_enabled_idx" ON "workflow_edge" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_edge_workflow_edge_id_idx" ON "workflow_edge" USING btree ("workflow_id","edge_id");--> statement-breakpoint
CREATE INDEX "workflow_edge_created_by_idx" ON "workflow_edge" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workflow_execution_step_execution_id_idx" ON "workflow_execution_step" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_step_workflow_id_idx" ON "workflow_execution_step" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_step_tenant_id_idx" ON "workflow_execution_step" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_step_step_id_idx" ON "workflow_execution_step" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_step_status_idx" ON "workflow_execution_step" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_execution_step_started_at_idx" ON "workflow_execution_step" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_execution_step_execution_step_id_idx" ON "workflow_execution_step" USING btree ("execution_id","step_id");--> statement-breakpoint
CREATE INDEX "workflow_node_workflow_id_idx" ON "workflow_node" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_node_tenant_id_idx" ON "workflow_node" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_node_node_id_idx" ON "workflow_node" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "workflow_node_type_idx" ON "workflow_node" USING btree ("type");--> statement-breakpoint
CREATE INDEX "workflow_node_category_idx" ON "workflow_node" USING btree ("category");--> statement-breakpoint
CREATE INDEX "workflow_node_is_enabled_idx" ON "workflow_node" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_node_workflow_node_id_idx" ON "workflow_node" USING btree ("workflow_id","node_id");--> statement-breakpoint
CREATE INDEX "workflow_node_created_by_idx" ON "workflow_node" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workflow_template_tenant_id_idx" ON "workflow_template" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_template_category_idx" ON "workflow_template" USING btree ("category");--> statement-breakpoint
CREATE INDEX "workflow_template_is_public_idx" ON "workflow_template" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "workflow_template_is_system_idx" ON "workflow_template" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "workflow_template_is_active_idx" ON "workflow_template" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflow_template_created_by_idx" ON "workflow_template" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workflow_trigger_workflow_id_idx" ON "workflow_trigger" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_trigger_tenant_id_idx" ON "workflow_trigger" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_trigger_type_idx" ON "workflow_trigger" USING btree ("type");--> statement-breakpoint
CREATE INDEX "workflow_trigger_event_type_idx" ON "workflow_trigger" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_trigger_webhook_endpoint_idx" ON "workflow_trigger" USING btree ("webhook_endpoint");--> statement-breakpoint
CREATE INDEX "workflow_trigger_is_active_idx" ON "workflow_trigger" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflow_trigger_created_by_idx" ON "workflow_trigger" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workflow_variable_workflow_id_idx" ON "workflow_variable" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_variable_tenant_id_idx" ON "workflow_variable" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_variable_name_idx" ON "workflow_variable" USING btree ("name");--> statement-breakpoint
CREATE INDEX "workflow_variable_type_idx" ON "workflow_variable" USING btree ("type");--> statement-breakpoint
CREATE INDEX "workflow_variable_scope_idx" ON "workflow_variable" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_variable_workflow_name_idx" ON "workflow_variable" USING btree ("workflow_id","name");--> statement-breakpoint
CREATE INDEX "workflow_variable_created_by_idx" ON "workflow_variable" USING btree ("created_by");