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
