CREATE TABLE "hierarchy_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"organization_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"scope_type" varchar(50) NOT NULL,
	"scope_id" uuid,
	"applies_to_children" boolean DEFAULT false,
	"max_depth" integer,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_hierarchy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_organization_id" uuid,
	"tenant_id" uuid NOT NULL,
	"hierarchy_level" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"can_access_children" boolean DEFAULT false,
	"can_access_parent" boolean DEFAULT false,
	"inherited_permissions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_hierarchy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_tenant_id" uuid,
	"hierarchy_level" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"can_access_children" boolean DEFAULT false,
	"can_access_parent" boolean DEFAULT false,
	"inherited_permissions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "parent_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "hierarchy_level" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "path" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "settings_inheritance" jsonb;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "parent_tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "hierarchy_level" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "path" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "settings_inheritance" jsonb;--> statement-breakpoint
ALTER TABLE "hierarchy_role" ADD CONSTRAINT "hierarchy_role_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hierarchy_role" ADD CONSTRAINT "hierarchy_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_hierarchy" ADD CONSTRAINT "organization_hierarchy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_hierarchy" ADD CONSTRAINT "organization_hierarchy_parent_organization_id_organization_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_hierarchy" ADD CONSTRAINT "organization_hierarchy_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_hierarchy" ADD CONSTRAINT "tenant_hierarchy_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_hierarchy" ADD CONSTRAINT "tenant_hierarchy_parent_tenant_id_tenant_id_fk" FOREIGN KEY ("parent_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hierarchy_role_tenant_id_idx" ON "hierarchy_role" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hierarchy_role_organization_id_idx" ON "hierarchy_role" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "hierarchy_role_scope_type_idx" ON "hierarchy_role" USING btree ("scope_type");--> statement-breakpoint
CREATE INDEX "hierarchy_role_scope_id_idx" ON "hierarchy_role" USING btree ("scope_id");--> statement-breakpoint
CREATE INDEX "organization_hierarchy_organization_id_idx" ON "organization_hierarchy" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_hierarchy_parent_organization_id_idx" ON "organization_hierarchy" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX "organization_hierarchy_tenant_id_idx" ON "organization_hierarchy" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "organization_hierarchy_hierarchy_level_idx" ON "organization_hierarchy" USING btree ("hierarchy_level");--> statement-breakpoint
CREATE INDEX "organization_hierarchy_path_idx" ON "organization_hierarchy" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_hierarchy_org_parent_idx" ON "organization_hierarchy" USING btree ("organization_id","parent_organization_id");--> statement-breakpoint
CREATE INDEX "tenant_hierarchy_tenant_id_idx" ON "tenant_hierarchy" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_hierarchy_parent_tenant_id_idx" ON "tenant_hierarchy" USING btree ("parent_tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_hierarchy_hierarchy_level_idx" ON "tenant_hierarchy" USING btree ("hierarchy_level");--> statement-breakpoint
CREATE INDEX "tenant_hierarchy_path_idx" ON "tenant_hierarchy" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_hierarchy_tenant_parent_idx" ON "tenant_hierarchy" USING btree ("tenant_id","parent_tenant_id");--> statement-breakpoint
CREATE INDEX "organization_parent_organization_id_idx" ON "organization" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX "organization_hierarchy_level_idx" ON "organization" USING btree ("hierarchy_level");--> statement-breakpoint
CREATE INDEX "organization_path_idx" ON "organization" USING btree ("path");--> statement-breakpoint
CREATE INDEX "tenant_parent_tenant_id_idx" ON "tenant" USING btree ("parent_tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_hierarchy_level_idx" ON "tenant" USING btree ("hierarchy_level");--> statement-breakpoint
CREATE INDEX "tenant_path_idx" ON "tenant" USING btree ("path");