---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [finbuckle, multi-tenant, identity, jwt, ef-core, postgresql, rls, interceptor]

# Dependency graph
requires:
  - phase: 01-01
    provides: ".NET 10 solution with Domain entities, ApplicationDbContext, TenantDbContext, ITenantProvider interface"
provides:
  - "Finbuckle multi-tenancy with subdomain resolution and EF Core store"
  - "TenantProvider implementing ITenantProvider via Finbuckle context"
  - "TenantDbConnectionInterceptor setting PostgreSQL app.current_tenant session variable"
  - "AuditableEntityInterceptor for CreatedAt/UpdatedAt timestamps"
  - "TenantResolutionMiddleware with exempt paths for non-tenant endpoints"
  - "DependencyInjection.cs registering all Infrastructure services"
  - "ASP.NET Core Identity with email confirmation, password policy, lockout"
  - "JWT Bearer authentication with token validation"
  - "Custom login endpoint at /api/auth/login-extended with rememberMe and 2FA"
  - "CustomClaimsFactory adding organizationId to claims"
  - "InitialCreate EF Core migrations for ApplicationDbContext and TenantDbContext"
  - "Default Admin and Member roles seeded on startup"
affects: [01-04, 01-05, 01-06, 01-07, 01-08]

# Tech tracking
tech-stack:
  added:
    - "Microsoft.AspNetCore.Authentication.JwtBearer 10.0.3 (Infrastructure)"
    - "Microsoft.EntityFrameworkCore.Design 10.0.3 (Infrastructure + Api)"
    - "dotnet-ef 10.0.3 (global tool)"
  patterns:
    - "Triple-layer tenant isolation fully wired: Finbuckle middleware + EF Core query filters + PostgreSQL RLS interceptor"
    - "DependencyInjection.cs extension method pattern for Infrastructure service registration"
    - "Custom login endpoint alongside MapIdentityApi for JWT with custom claims"
    - "EF Core interceptor chain: TenantDbConnectionInterceptor + AuditableEntityInterceptor"
    - "TenantDbContext extends EFCoreStoreDbContext for Finbuckle tenant store"

key-files:
  created:
    - "src/GlobCRM.Infrastructure/MultiTenancy/TenantInfo.cs"
    - "src/GlobCRM.Infrastructure/MultiTenancy/TenantProvider.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Interceptors/TenantDbConnectionInterceptor.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Interceptors/AuditableEntityInterceptor.cs"
    - "src/GlobCRM.Api/Middleware/TenantResolutionMiddleware.cs"
    - "src/GlobCRM.Infrastructure/DependencyInjection.cs"
    - "src/GlobCRM.Infrastructure/Identity/CustomClaimsFactory.cs"
    - "src/GlobCRM.Infrastructure/Identity/CustomLoginEndpoint.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Migrations/20260216131006_InitialCreate.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Migrations/Tenant/20260216131017_InitialCreate.cs"
  modified:
    - "src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs"
    - "src/GlobCRM.Infrastructure/Persistence/TenantDbContext.cs"
    - "src/GlobCRM.Api/Program.cs"
    - "src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj"
    - "src/GlobCRM.Api/GlobCRM.Api.csproj"

key-decisions:
  - "TenantDbContext extends EFCoreStoreDbContext<TenantInfo> for Finbuckle EF Core store integration"
  - "Custom TenantInfo class adds OrganizationId (Guid) on top of Finbuckle base"
  - "Development mode uses WithHeaderStrategy('X-Tenant-Id') fallback for local testing"
  - "JWT authentication is default scheme; Identity bearer tokens coexist for built-in endpoints"
  - "Custom login endpoint generates JWTs; built-in MapIdentityApi uses opaque bearer tokens"
  - "Separate migrations for ApplicationDbContext and TenantDbContext in different directories"

patterns-established:
  - "DependencyInjection.cs: AddInfrastructure(services, configuration, environment) extension method"
  - "Middleware pipeline order: UseSerilog > UseHttpsRedirection > UseCors > UseMultiTenant > UseTenantResolution > UseAuthentication > UseAuthorization"
  - "Role seeding via SeedRolesAsync on startup with idempotent role creation"
  - "TenantInfo alias pattern: using TenantInfo = GlobCRM.Infrastructure.MultiTenancy.TenantInfo to disambiguate"
  - "Exempt paths in TenantResolutionMiddleware for non-tenant operations"

# Metrics
duration: 8min
completed: 2026-02-16
---

# Phase 1 Plan 3: Multi-Tenancy Infrastructure & Identity Configuration Summary

**Finbuckle subdomain-based multi-tenancy with PostgreSQL RLS interceptor, ASP.NET Core Identity with custom JWT login endpoint, and initial EF Core migrations**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-16T13:03:24Z
- **Completed:** 2026-02-16T13:11:31Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Wired complete triple-layer tenant isolation: Finbuckle middleware (subdomain resolution) + EF Core query filters (ApplicationDbContext) + PostgreSQL RLS interceptor (TenantDbConnectionInterceptor sets app.current_tenant)
- Configured ASP.NET Core Identity with all security options: email confirmation required, 8-char password with complexity, 15-min lockout after 5 attempts
- Created custom login endpoint at /api/auth/login-extended that generates JWT with organizationId claim and handles rememberMe (30-min vs 30-day sessions) plus 2FA flow
- Generated InitialCreate EF Core migrations for both ApplicationDbContext (Identity + tenant-scoped tables) and TenantDbContext (tenant catalog + Finbuckle store)
- Seeded default Admin and Member roles on application startup

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Finbuckle multi-tenancy with subdomain resolution and RLS interceptor** - `9874907` (feat)
2. **Task 2: Configure ASP.NET Core Identity with JWT and custom login endpoint** - `7498bbe` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantInfo.cs` - Finbuckle tenant info with OrganizationId mapping
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantProvider.cs` - ITenantProvider implementation using Finbuckle context
- `src/GlobCRM.Infrastructure/Persistence/Interceptors/TenantDbConnectionInterceptor.cs` - Sets app.current_tenant via set_config on every connection
- `src/GlobCRM.Infrastructure/Persistence/Interceptors/AuditableEntityInterceptor.cs` - Auto-sets CreatedAt/UpdatedAt timestamps
- `src/GlobCRM.Api/Middleware/TenantResolutionMiddleware.cs` - Validates tenant context with exempt paths
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Registers Finbuckle, DbContexts, Identity, JWT, interceptors
- `src/GlobCRM.Infrastructure/Identity/CustomClaimsFactory.cs` - Adds organizationId/organizationName to claims
- `src/GlobCRM.Infrastructure/Identity/CustomLoginEndpoint.cs` - JWT login with rememberMe and 2FA support
- `src/GlobCRM.Infrastructure/Persistence/Migrations/20260216131006_InitialCreate.cs` - ApplicationDbContext migration
- `src/GlobCRM.Infrastructure/Persistence/Migrations/Tenant/20260216131017_InitialCreate.cs` - TenantDbContext migration
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Updated with TenantInfo alias
- `src/GlobCRM.Infrastructure/Persistence/TenantDbContext.cs` - Extends EFCoreStoreDbContext for Finbuckle store
- `src/GlobCRM.Api/Program.cs` - Full middleware pipeline with Identity endpoints and role seeding

## Decisions Made
- Extended TenantDbContext from `EFCoreStoreDbContext<TenantInfo>` so Finbuckle's EF Core store can use it directly as the tenant catalog
- Created custom TenantInfo class with OrganizationId (Guid) property mapping to Organization table, on top of Finbuckle's base TenantInfo (which has string Id and Identifier)
- In development mode, added `WithHeaderStrategy("X-Tenant-Id")` as a fallback tenant resolution strategy for local testing without subdomains
- Configured JWT bearer as the default authentication scheme, while keeping Identity's built-in bearer tokens for MapIdentityApi endpoints (register, confirm email, etc.)
- Created separate migration directories: `Persistence/Migrations/` for ApplicationDbContext and `Persistence/Migrations/Tenant/` for TenantDbContext
- TenantResolutionMiddleware passes through in development mode when no tenant is resolved, allowing non-tenant endpoints to work without subdomain setup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Disambiguated TenantInfo reference in middleware**
- **Found during:** Task 1 (TenantResolutionMiddleware compilation)
- **Issue:** `TenantInfo` was ambiguous between `Finbuckle.MultiTenant.Abstractions.TenantInfo` and `GlobCRM.Infrastructure.MultiTenancy.TenantInfo`
- **Fix:** Added `using TenantInfo = GlobCRM.Infrastructure.MultiTenancy.TenantInfo;` alias
- **Files modified:** src/GlobCRM.Api/Middleware/TenantResolutionMiddleware.cs
- **Verification:** Build compiles with 0 errors
- **Committed in:** 9874907 (Task 1 commit)

**2. [Rule 3 - Blocking] Added JwtBearer package to Infrastructure project**
- **Found during:** Task 2 (Identity configuration in DependencyInjection.cs)
- **Issue:** `Microsoft.AspNetCore.Authentication.JwtBearer` was only in the Api project, but DependencyInjection.cs in Infrastructure needs it for AddJwtBearer registration
- **Fix:** Added `Microsoft.AspNetCore.Authentication.JwtBearer 10.0.3` package to Infrastructure project
- **Files modified:** src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
- **Verification:** Build compiles with 0 errors
- **Committed in:** 7498bbe (Task 2 commit)

**3. [Rule 3 - Blocking] Added EF Core Design package to both projects**
- **Found during:** Task 2 (EF Core migration creation)
- **Issue:** `dotnet ef migrations add` requires `Microsoft.EntityFrameworkCore.Design` in both the project (-p) and startup project (-s)
- **Fix:** Added `Microsoft.EntityFrameworkCore.Design 10.0.3` to both Infrastructure and Api projects; installed `dotnet-ef` tool globally
- **Files modified:** src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj, src/GlobCRM.Api/GlobCRM.Api.csproj
- **Verification:** Migrations created successfully for both DbContexts
- **Committed in:** 7498bbe (Task 2 commit)

**4. [Rule 2 - Missing Critical] Created separate TenantDbContext migration**
- **Found during:** Task 2 (EF Core migration creation)
- **Issue:** Plan only mentioned one migration for ApplicationDbContext, but TenantDbContext also needs its own migration (it has the Organizations table and Finbuckle TenantInfo table)
- **Fix:** Created separate migration in `Persistence/Migrations/Tenant/` for TenantDbContext
- **Files modified:** Added 3 migration files in Persistence/Migrations/Tenant/
- **Verification:** `dotnet ef migrations list` shows InitialCreate for both contexts
- **Committed in:** 7498bbe (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 2 blocking, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for compilation and correct migration setup. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required for this plan. PostgreSQL database must be running before applying migrations in a later step.

## Next Phase Readiness
- Multi-tenancy infrastructure complete, ready for tenant-scoped endpoints (Plan 04+)
- Identity configuration complete, ready for auth page integration (Plan 06)
- Custom login endpoint ready for Angular auth service integration
- EF Core migrations ready to apply once PostgreSQL is available
- DependencyInjection.cs ready for additional service registrations (email, repositories) from Plan 04

## Self-Check: PASSED

- All 15 key files verified present on disk
- Both task commits verified (9874907, 7498bbe)
- Solution builds with 0 errors, 0 warnings
- EF Core migrations exist for both ApplicationDbContext and TenantDbContext

---
*Phase: 01-foundation*
*Completed: 2026-02-16*
