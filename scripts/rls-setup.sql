-- =====================================================================
-- GlobCRM PostgreSQL Row-Level Security (RLS) Setup
-- =====================================================================
-- This is Layer 3 of the triple-layer tenant isolation defense:
--
--   Layer 1: Middleware (Finbuckle subdomain resolution)
--            - Resolves tenant from subdomain in every HTTP request
--            - Sets tenant context before any business logic executes
--
--   Layer 2: EF Core Global Query Filters (ApplicationDbContext)
--            - Automatically appends WHERE tenant_id = @currentTenant
--            - Can be bypassed with IgnoreQueryFilters() (hence Layer 3)
--
--   Layer 3: PostgreSQL Row-Level Security (this script)
--            - Database-level enforcement that cannot be bypassed by app code
--            - Uses session variable app.current_tenant set by EF Core interceptor
--            - Even if Layers 1 and 2 fail, data stays isolated
--
-- The app.current_tenant session variable is set on every database connection
-- by the TenantDbConnectionInterceptor:
--   SELECT set_config('app.current_tenant', '{tenant_id}', false);
-- =====================================================================

-- Step 1: Create a dedicated application database role (non-superuser)
-- IMPORTANT: The application MUST NOT connect as a superuser or the
-- database owner, because superusers and table owners bypass RLS.
-- See: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'globcrm_app') THEN
        CREATE ROLE globcrm_app LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
    END IF;
END
$$;

-- Grant necessary permissions to the application role
GRANT CONNECT ON DATABASE globcrm TO globcrm_app;
GRANT USAGE ON SCHEMA public TO globcrm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO globcrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO globcrm_app;

-- Also grant sequence usage for auto-generated IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO globcrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO globcrm_app;

-- Step 2: Enable RLS on tenant-scoped tables
-- Note: The organizations table is the tenant catalog and is NOT RLS-protected.
-- Only tables that hold per-tenant data get RLS policies.

-- =====================================================================
-- AspNetUsers (ApplicationUser) - filtered by organization_id
-- =====================================================================
ALTER TABLE "AspNetUsers" ENABLE ROW LEVEL SECURITY;

-- Force RLS for the table owner as well (belt and suspenders)
ALTER TABLE "AspNetUsers" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON "AspNetUsers"
    USING (organization_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_users ON "AspNetUsers" IS
    'Ensures users can only see and modify users within their own organization. '
    'The app.current_tenant session variable is set by the EF Core connection interceptor.';

-- =====================================================================
-- Invitations - filtered by tenant_id
-- =====================================================================
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invitations ON invitations
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_invitations ON invitations IS
    'Ensures invitation queries only return invitations for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- Roles - filtered by tenant_id
-- =====================================================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE roles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_roles ON roles
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_roles ON roles IS
    'Ensures role queries only return roles for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- Teams - filtered by tenant_id
-- =====================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

ALTER TABLE teams FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_teams ON teams
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_teams ON teams IS
    'Ensures team queries only return teams for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: Child tables (role_permissions, role_field_permissions, team_members,
-- user_role_assignments) do NOT need RLS policies. They are accessed through
-- FK joins from their tenant-filtered parents (roles, teams).

-- =====================================================================
-- custom_field_definitions - filtered by tenant_id
-- =====================================================================
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE custom_field_definitions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_custom_field_definitions ON custom_field_definitions
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_custom_field_definitions ON custom_field_definitions IS
    'Ensures custom field definitions are isolated per tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- custom_field_sections - filtered by tenant_id
-- =====================================================================
ALTER TABLE custom_field_sections ENABLE ROW LEVEL SECURITY;

ALTER TABLE custom_field_sections FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_custom_field_sections ON custom_field_sections
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_custom_field_sections ON custom_field_sections IS
    'Ensures custom field sections are isolated per tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- saved_views - filtered by tenant_id
-- =====================================================================
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

ALTER TABLE saved_views FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_saved_views ON saved_views
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_saved_views ON saved_views IS
    'Ensures saved views are isolated per tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- companies - filtered by tenant_id
-- =====================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE companies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_companies ON companies
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_companies ON companies IS
    'Ensures company queries only return companies for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- contacts - filtered by tenant_id
-- =====================================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_contacts ON contacts
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_contacts ON contacts IS
    'Ensures contact queries only return contacts for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- products - filtered by tenant_id
-- =====================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_products ON products
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_products ON products IS
    'Ensures product queries only return products for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- pipelines - filtered by tenant_id
-- =====================================================================
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

ALTER TABLE pipelines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pipelines ON pipelines
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_pipelines ON pipelines IS
    'Ensures pipeline queries only return pipelines for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- deals - filtered by tenant_id
-- =====================================================================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

ALTER TABLE deals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_deals ON deals
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_deals ON deals IS
    'Ensures deal queries only return deals for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: Child tables (pipeline_stages, deal_contacts, deal_products,
-- deal_stage_histories) do NOT need RLS policies. They are accessed through
-- FK joins from their tenant-filtered parents (pipelines, deals).

-- =====================================================================
-- leads - filtered by tenant_id
-- =====================================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE leads FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_leads ON leads
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_leads ON leads IS
    'Ensures lead queries only return leads for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- lead_stages - filtered by tenant_id
-- =====================================================================
ALTER TABLE lead_stages ENABLE ROW LEVEL SECURITY;

ALTER TABLE lead_stages FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_lead_stages ON lead_stages
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_lead_stages ON lead_stages IS
    'Ensures lead stage queries only return stages for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- lead_sources - filtered by tenant_id
-- =====================================================================
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE lead_sources FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_lead_sources ON lead_sources
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_lead_sources ON lead_sources IS
    'Ensures lead source queries only return sources for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: Child tables (lead_stage_histories, lead_conversions) do NOT need
-- RLS policies. They are accessed through FK joins from their tenant-filtered
-- parent (leads).

-- =====================================================================
-- activities - filtered by tenant_id
-- =====================================================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE activities FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_activities ON activities
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_activities ON activities IS
    'Ensures activity queries only return activities for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: Child tables (activity_comments, activity_attachments, activity_time_entries,
-- activity_followers, activity_links, activity_status_histories) do NOT need RLS
-- policies. They are accessed through FK joins from their tenant-filtered parent (activities).

-- =====================================================================
-- quotes - filtered by tenant_id
-- =====================================================================
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

ALTER TABLE quotes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_quotes ON quotes
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_quotes ON quotes IS
    'Ensures quote queries only return quotes for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- requests - filtered by tenant_id
-- =====================================================================
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_requests ON requests
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_requests ON requests IS
    'Ensures request queries only return requests for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: Child tables (quote_line_items, quote_status_history) do NOT need RLS
-- policies. They are accessed through FK joins from their tenant-filtered parent (quotes).

-- =====================================================================
-- email_accounts - filtered by tenant_id
-- =====================================================================
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_email_accounts ON email_accounts
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_email_accounts ON email_accounts IS
    'Ensures email account queries only return accounts for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- email_messages - filtered by tenant_id
-- =====================================================================
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_email_messages ON email_messages
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_email_messages ON email_messages IS
    'Ensures email message queries only return messages for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- email_threads - filtered by tenant_id
-- =====================================================================
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_threads FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_email_threads ON email_threads
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_email_threads ON email_threads IS
    'Ensures email thread queries only return threads for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- notifications - filtered by tenant_id
-- =====================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notifications ON notifications
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_notifications ON notifications IS
    'Ensures notification queries only return notifications for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- notification_preferences - filtered by tenant_id
-- =====================================================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notification_preferences ON notification_preferences
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_notification_preferences ON notification_preferences IS
    'Ensures notification preferences are isolated per tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- feed_items - filtered by tenant_id
-- =====================================================================
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE feed_items FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_feed_items ON feed_items
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_feed_items ON feed_items IS
    'Ensures feed item queries only return items for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: feed_comments does NOT need an RLS policy. It is accessed through
-- FK joins from its tenant-filtered parent (feed_items).

-- =====================================================================
-- dashboards - filtered by tenant_id
-- =====================================================================
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

ALTER TABLE dashboards FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_dashboards ON dashboards
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_dashboards ON dashboards IS
    'Ensures dashboard queries only return dashboards for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- targets - filtered by tenant_id
-- =====================================================================
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

ALTER TABLE targets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_targets ON targets
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_targets ON targets IS
    'Ensures target queries only return targets for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: dashboard_widgets does NOT need an RLS policy. It is accessed through
-- FK joins from its tenant-filtered parent (dashboards).

-- =====================================================================
-- email_template_categories - filtered by tenant_id
-- =====================================================================
ALTER TABLE email_template_categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_template_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_email_template_categories ON email_template_categories
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_email_template_categories ON email_template_categories IS
    'Ensures email template category queries only return categories for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- email_templates - filtered by tenant_id
-- =====================================================================
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_email_templates ON email_templates
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_email_templates ON email_templates IS
    'Ensures email template queries only return templates for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- duplicate_matching_configs - filtered by tenant_id
-- =====================================================================
ALTER TABLE duplicate_matching_configs ENABLE ROW LEVEL SECURITY;

ALTER TABLE duplicate_matching_configs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_duplicate_matching_configs ON duplicate_matching_configs
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_duplicate_matching_configs ON duplicate_matching_configs IS
    'Ensures duplicate matching config queries only return configs for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- merge_audit_logs - filtered by tenant_id
-- =====================================================================
ALTER TABLE merge_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE merge_audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_merge_audit_logs ON merge_audit_logs
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_merge_audit_logs ON merge_audit_logs IS
    'Ensures merge audit log queries only return logs for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- webhook_subscriptions - filtered by tenant_id
-- =====================================================================
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE webhook_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_webhook_subscriptions ON webhook_subscriptions
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_webhook_subscriptions ON webhook_subscriptions IS
    'Ensures webhook subscription queries only return subscriptions for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- webhook_delivery_logs - filtered by tenant_id
-- =====================================================================
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE webhook_delivery_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_webhook_delivery_logs ON webhook_delivery_logs
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_webhook_delivery_logs ON webhook_delivery_logs IS
    'Ensures webhook delivery log queries only return logs for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- email_sequences - filtered by tenant_id
-- =====================================================================
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_sequences FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_email_sequences ON email_sequences
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_email_sequences ON email_sequences IS
    'Ensures email sequence queries only return sequences for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: email_sequence_steps does NOT need an RLS policy. It is accessed through
-- FK joins from its tenant-filtered parent (email_sequences).

-- =====================================================================
-- sequence_enrollments - filtered by tenant_id
-- =====================================================================
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

ALTER TABLE sequence_enrollments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_sequence_enrollments ON sequence_enrollments
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_sequence_enrollments ON sequence_enrollments IS
    'Ensures sequence enrollment queries only return enrollments for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- sequence_tracking_events - filtered by tenant_id
-- =====================================================================
ALTER TABLE sequence_tracking_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE sequence_tracking_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_sequence_tracking_events ON sequence_tracking_events
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_sequence_tracking_events ON sequence_tracking_events IS
    'Ensures sequence tracking event queries only return events for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- workflows - filtered by tenant_id
-- =====================================================================
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

ALTER TABLE workflows FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_workflows ON workflows
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_workflows ON workflows IS
    'Ensures workflow queries only return workflows for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- workflow_execution_logs - filtered by tenant_id
-- =====================================================================
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE workflow_execution_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_workflow_execution_logs ON workflow_execution_logs
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_workflow_execution_logs ON workflow_execution_logs IS
    'Ensures workflow execution log queries only return logs for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- Note: workflow_action_logs does NOT need an RLS policy. It is accessed through
-- FK joins from its tenant-filtered parent (workflow_execution_logs).

-- =====================================================================
-- workflow_templates - filtered by tenant_id
-- =====================================================================
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE workflow_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_workflow_templates ON workflow_templates
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_workflow_templates ON workflow_templates IS
    'Ensures workflow template queries only return templates for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- reports - filtered by tenant_id
-- =====================================================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE reports FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_reports ON reports
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_reports ON reports IS
    'Ensures report queries only return reports for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- report_categories - filtered by tenant_id
-- =====================================================================
ALTER TABLE report_categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE report_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_report_categories ON report_categories
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_report_categories ON report_categories IS
    'Ensures report category queries only return categories for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- integrations - filtered by tenant_id
-- =====================================================================
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_integrations ON integrations
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_integrations ON integrations IS
    'Ensures integration queries only return integrations for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- integration_activity_logs - filtered by tenant_id
-- =====================================================================
ALTER TABLE integration_activity_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE integration_activity_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_integration_activity_logs ON integration_activity_logs
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY tenant_isolation_integration_activity_logs ON integration_activity_logs IS
    'Ensures integration activity log queries only return logs for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- quote_templates - filtered by tenant_id
-- =====================================================================
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE quote_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_templates_tenant_isolation ON quote_templates;
CREATE POLICY quote_templates_tenant_isolation ON quote_templates
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON POLICY quote_templates_tenant_isolation ON quote_templates IS
    'Ensures quote template queries only return templates for the current tenant. '
    'Uses the app.current_tenant session variable set by EF Core interceptor.';

-- =====================================================================
-- Notes on current_setting usage
-- =====================================================================
-- current_setting('app.current_tenant', true) uses the `true` parameter
-- to return NULL instead of raising an error when the setting is not found.
-- This prevents errors during migrations and admin operations where
-- the tenant context may not be set.
--
-- When connecting as the application user (globcrm_app), the EF Core
-- TenantDbConnectionInterceptor runs:
--   SELECT set_config('app.current_tenant', '{tenant_id}', false);
-- on every connection open, ensuring RLS policies can filter correctly.
-- =====================================================================
