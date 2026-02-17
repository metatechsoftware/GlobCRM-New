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
