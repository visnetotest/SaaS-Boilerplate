-- Workflow Automation System Migration
-- Adds comprehensive workflow automation tables to support business process automation

-- Create workflow execution steps table for granular step tracking
CREATE TABLE IF NOT EXISTS workflow_step_execution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_execution(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- pending, running, completed, failed, skipped
    
    -- Step details
    name VARCHAR(255) NOT NULL,
    config JSONB,
    input_data JSONB,
    output_data JSONB,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    retry_count INTEGER DEFAULT 0,
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create workflow approval table for approval workflows
CREATE TABLE IF NOT EXISTS workflow_approval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_execution(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    
    -- Approval details
    user_id UUID NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, approved, rejected, expired
    comment TEXT,
    
    -- Timing
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Configuration
    require_all BOOLEAN DEFAULT false NOT NULL, -- Whether all approvers must approve
    approvers JSONB NOT NULL, -- Array of user IDs who can approve
    
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create workflow variables table for dynamic variable management
CREATE TABLE IF NOT EXISTS workflow_variable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_execution(id) ON DELETE CASCADE,
    
    -- Variable details
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- string, number, boolean, date, object, array
    value JSONB,
    
    -- Metadata
    description TEXT,
    required BOOLEAN DEFAULT false NOT NULL,
    scope VARCHAR(50) DEFAULT 'execution' NOT NULL, -- execution, workflow, global
    
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(execution_id, name, scope)
);

-- Create workflow templates table for reusable workflows
CREATE TABLE IF NOT EXISTS workflow_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    tags TEXT[], -- Array of tags for search
    
    -- Template configuration
    definition JSONB NOT NULL, -- Workflow definition/steps
    variables JSONB, -- Variable definitions
    settings JSONB,
    
    -- Template metadata
    is_public BOOLEAN DEFAULT false NOT NULL,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    author_id UUID REFERENCES user(id),
    
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create workflow integrations table for external service connections
CREATE TABLE IF NOT EXISTS workflow_integration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Integration details
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- rest-api, webhook, database, file-storage, email, calendar
    provider VARCHAR(100) NOT NULL, -- google, microsoft, slack, etc.
    
    -- Configuration
    config JSONB NOT NULL,
    credentials JSONB, -- Encrypted credentials
    
    -- Status
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_tested TIMESTAMP WITH TIME ZONE,
    test_status VARCHAR(20), -- success, failed, pending
    
    -- Rate limiting
    rate_limit JSONB, -- Rate limiting configuration
    
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create workflow schedules table for automated workflow execution
CREATE TABLE IF NOT EXISTS workflow_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    
    -- Schedule configuration
    name VARCHAR(255) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL, -- cron, interval, once
    schedule_expression VARCHAR(255) NOT NULL, -- Cron expression or ISO interval
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Status
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    
    -- Execution limits
    max_executions INTEGER,
    current_executions INTEGER DEFAULT 0,
    
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create workflow analytics table for performance tracking
CREATE TABLE IF NOT EXISTS workflow_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    
    -- Time period (for aggregations)
    period_type VARCHAR(10) NOT NULL, -- hour, day, week, month
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Metrics
    total_executions INTEGER DEFAULT 0 NOT NULL,
    successful_executions INTEGER DEFAULT 0 NOT NULL,
    failed_executions INTEGER DEFAULT 0 NOT NULL,
    average_duration INTEGER, -- in seconds
    min_duration INTEGER,
    max_duration INTEGER,
    
    -- Performance metrics
    p95_duration INTEGER, -- 95th percentile duration
    p99_duration INTEGER, -- 99th percentile duration
    
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(workflow_id, period_type, period_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_step_execution_execution_id ON workflow_step_execution(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_execution_status ON workflow_step_execution(status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_execution_tenant_id ON workflow_step_execution(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_execution_started_at ON workflow_step_execution(started_at);

CREATE INDEX IF NOT EXISTS idx_workflow_approval_execution_id ON workflow_approval(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approval_user_id ON workflow_approval(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approval_status ON workflow_approval(status);
CREATE INDEX IF NOT EXISTS idx_workflow_approval_tenant_id ON workflow_approval(tenant_id);

CREATE INDEX IF NOT EXISTS idx_workflow_variable_execution_id ON workflow_variable(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_variable_tenant_id ON workflow_variable(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_variable_name ON workflow_variable(name);

CREATE INDEX IF NOT EXISTS idx_workflow_template_tenant_id ON workflow_template(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_template_category ON workflow_template(category);
CREATE INDEX IF NOT EXISTS idx_workflow_template_is_public ON workflow_template(is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_template_tags ON workflow_template USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_workflow_integration_tenant_id ON workflow_integration(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_integration_type ON workflow_integration(type);
CREATE INDEX IF NOT EXISTS idx_workflow_integration_provider ON workflow_integration(provider);
CREATE INDEX IF NOT EXISTS idx_workflow_integration_is_active ON workflow_integration(is_active);

CREATE INDEX IF NOT EXISTS idx_workflow_schedule_workflow_id ON workflow_schedule(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedule_next_run ON workflow_schedule(next_run);
CREATE INDEX IF NOT EXISTS idx_workflow_schedule_is_active ON workflow_schedule(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_schedule_tenant_id ON workflow_schedule(tenant_id);

CREATE INDEX IF NOT EXISTS idx_workflow_analytics_workflow_id ON workflow_analytics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_period ON workflow_analytics(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_tenant_id ON workflow_analytics(tenant_id);

-- Enable Row Level Security (RLS) for all new tables
ALTER TABLE workflow_step_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_variable ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_integration ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_step_execution
CREATE POLICY workflow_step_execution_tenant_policy ON workflow_step_execution
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for workflow_approval
CREATE POLICY workflow_approval_tenant_policy ON workflow_approval
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for workflow_variable
CREATE POLICY workflow_variable_tenant_policy ON workflow_variable
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for workflow_template (public templates visible to all, private only to tenant)
CREATE POLICY workflow_template_public_policy ON workflow_template
    FOR SELECT TO authenticated
    USING (is_public = true OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY workflow_template_tenant_policy ON workflow_template
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for workflow_integration
CREATE POLICY workflow_integration_tenant_policy ON workflow_integration
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for workflow_schedule
CREATE POLICY workflow_schedule_tenant_policy ON workflow_schedule
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for workflow_analytics
CREATE POLICY workflow_analytics_tenant_policy ON workflow_analytics
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create or update function to automatically update analytics
CREATE OR REPLACE FUNCTION update_workflow_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update daily analytics when workflow execution completes
    IF TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'failed') THEN
        INSERT INTO workflow_analytics (
            workflow_id, 
            period_type, 
            period_start, 
            period_end,
            total_executions,
            successful_executions,
            failed_executions,
            average_duration,
            tenant_id
        )
        VALUES (
            NEW.workflow_id,
            'day',
            date_trunc('day', NEW.completed_at),
            date_trunc('day', NEW.completed_at) + INTERVAL '1 day',
            1,
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
            NEW.duration,
            NEW.tenant_id
        )
        ON CONFLICT (workflow_id, period_type, period_start) 
        DO UPDATE SET
            total_executions = workflow_analytics.total_executions + 1,
            successful_executions = workflow_analytics.successful_executions + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
            failed_executions = workflow_analytics.failed_executions + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
            average_duration = (workflow_analytics.average_duration * workflow_analytics.total_executions + NEW.duration) / (workflow_analytics.total_executions + 1),
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic analytics updates
DROP TRIGGER IF EXISTS workflow_execution_analytics_trigger ON workflow_execution;
CREATE TRIGGER workflow_execution_analytics_trigger
    AFTER UPDATE ON workflow_execution
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_analytics();

-- Grant permissions to application role
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_step_execution TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_approval TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_variable TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_template TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_integration TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_schedule TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_analytics TO app_role;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_role;

COMMIT;