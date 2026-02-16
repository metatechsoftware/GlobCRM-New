---
phase: 01-foundation
plan: 01
subsystem: database
tags: [dotnet, ef-core, postgresql, finbuckle, identity, multi-tenant, serilog, clean-architecture]

# Dependency graph
requires: []
provides:
  - ".NET 10 solution with Domain, Application, Infrastructure, Api layers"
  - "Organization, ApplicationUser, Invitation domain entities"
  - "ApplicationDbContext with tenant-scoped global query filters"
  - "TenantDbContext for tenant catalog operations"
  - "PostgreSQL RLS script for database-level tenant isolation"
  - "ITenantProvider, IOrganizationRepository, IEmailService, ITenantSeeder interfaces"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08]

# Tech tracking
tech-stack:
  added:
    - "Microsoft.Extensions.Identity.Stores 10.0.3"
    - "Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.3"
    - "Npgsql.EntityFrameworkCore.PostgreSQL 10.0.0"
    - "Finbuckle.MultiTenant 10.0.3"
    - "Finbuckle.MultiTenant.AspNetCore 10.0.3"
    - "Finbuckle.MultiTenant.EntityFrameworkCore 10.0.3"
    - "SendGrid 9.29.3"
    - "Serilog.AspNetCore 10.0.0"
    - "FluentValidation 12.1.1"
    - "FluentValidation.AspNetCore 11.3.1"
    - "Microsoft.AspNetCore.Authentication.JwtBearer 10.0.3"
  patterns:
    - "Clean architecture: Api -> Infrastructure -> Application -> Domain"
    - "Triple-layer tenant isolation: Middleware + EF Core query filters + PostgreSQL RLS"
    - "EF Core entity type configurations in separate files"
    - "Global query filters for automatic tenant data scoping"
    - "Snake_case database column naming via entity configurations"

key-files:
  created:
    - "GlobCRM.slnx"
    - "src/GlobCRM.Domain/Entities/Organization.cs"
    - "src/GlobCRM.Domain/Entities/ApplicationUser.cs"
    - "src/GlobCRM.Domain/Entities/Invitation.cs"
    - "src/GlobCRM.Domain/Entities/UserRole.cs"
    - "src/GlobCRM.Domain/Interfaces/ITenantProvider.cs"
    - "src/GlobCRM.Domain/Interfaces/IOrganizationRepository.cs"
    - "src/GlobCRM.Application/Common/IEmailService.cs"
    - "src/GlobCRM.Application/Common/ITenantSeeder.cs"
    - "src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs"
    - "src/GlobCRM.Infrastructure/Persistence/TenantDbContext.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Configurations/OrganizationConfiguration.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs"
    - "scripts/rls-setup.sql"
    - "src/GlobCRM.Api/Program.cs"
    - "src/GlobCRM.Api/appsettings.json"
    - "src/GlobCRM.Api/appsettings.Development.json"
  modified: []

key-decisions:
  - "Used .slnx format (new .NET 10 default) instead of legacy .sln"
  - "Added Microsoft.Extensions.Identity.Stores to Domain for IdentityUser<Guid> base class"
  - "Used Roles static class for string constants separate from UserRole enum"
  - "Global query filters use null-safe pattern (_tenantProvider == null || ...) for migration compatibility"
  - "FORCE ROW LEVEL SECURITY applied on tables so even table owners are subject to RLS"

patterns-established:
  - "Clean Architecture: Domain has no infrastructure dependencies except Identity Stores for IdentityUser"
  - "Entity configurations use snake_case column names with PostgreSQL conventions"
  - "Triple-layer defense for tenant isolation documented in RLS script and ApplicationDbContext"
  - "Serilog structured logging configured via appsettings.json"
  - "CORS configured for Angular dev server on localhost:4200"

# Metrics
duration: 8min
completed: 2026-02-16
---

# Phase 1 Plan 1: Foundation Solution & Domain Model Summary

**.NET 10 clean architecture solution with Organization/ApplicationUser/Invitation entities, EF Core DbContexts with tenant query filters, and PostgreSQL RLS script for triple-layer data isolation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-16T12:06:17Z
- **Completed:** 2026-02-16T12:14:46Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments
- Scaffolded complete .NET 10 solution with 4 clean architecture projects (Domain, Application, Infrastructure, Api)
- Defined all Phase 1 domain entities (Organization, ApplicationUser, Invitation, UserRole) with correct properties matching locked decisions
- Created tenant-scoped ApplicationDbContext with global query filters and TenantDbContext for catalog operations
- Created PostgreSQL RLS script implementing Layer 3 of triple-layer tenant isolation defense
- Configured Serilog logging, CORS for Angular dev, and appsettings with JWT/SendGrid/PostgreSQL sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold .NET 10 solution with clean architecture projects** - `ac3bb86` (feat)
2. **Task 2: Define domain entities, EF Core DbContexts, and RLS script** - `38fefaa` (feat)

## Files Created/Modified
- `GlobCRM.slnx` - Solution file referencing all 4 projects
- `src/GlobCRM.Domain/GlobCRM.Domain.csproj` - Domain project with Identity Stores package
- `src/GlobCRM.Application/GlobCRM.Application.csproj` - Application project with FluentValidation
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - Infrastructure with EF Core, Finbuckle, SendGrid, Serilog
- `src/GlobCRM.Api/GlobCRM.Api.csproj` - Api with JWT Bearer and FluentValidation.AspNetCore
- `src/GlobCRM.Api/Program.cs` - Minimal startup with Serilog, CORS, health endpoint
- `src/GlobCRM.Api/appsettings.json` - Production config with placeholders
- `src/GlobCRM.Api/appsettings.Development.json` - Development config with local PostgreSQL
- `src/GlobCRM.Domain/Entities/Organization.cs` - Tenant entity with subdomain, user_limit, is_active
- `src/GlobCRM.Domain/Entities/ApplicationUser.cs` - Identity user with OrganizationId, profile fields
- `src/GlobCRM.Domain/Entities/Invitation.cs` - Invitation with TenantId, Token, 7-day expiry
- `src/GlobCRM.Domain/Entities/UserRole.cs` - Admin/Member enum and Roles string constants
- `src/GlobCRM.Domain/Interfaces/ITenantProvider.cs` - Tenant context provider interface
- `src/GlobCRM.Domain/Interfaces/IOrganizationRepository.cs` - Organization CRUD interface
- `src/GlobCRM.Application/Common/IEmailService.cs` - Email sending interface
- `src/GlobCRM.Application/Common/ITenantSeeder.cs` - Org seed data interface
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Tenant-scoped IdentityDbContext with query filters
- `src/GlobCRM.Infrastructure/Persistence/TenantDbContext.cs` - Tenant catalog DbContext
- `src/GlobCRM.Infrastructure/Persistence/Configurations/OrganizationConfiguration.cs` - Org table config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs` - User table config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs` - Invitation table config
- `scripts/rls-setup.sql` - PostgreSQL RLS policies and application role
- `.gitignore` - .NET, Angular, IDE exclusions

## Decisions Made
- Used `.slnx` format (new .NET 10 default XML-based solution format) instead of legacy `.sln` -- this is the current standard
- Added `Microsoft.Extensions.Identity.Stores` to Domain project to provide `IdentityUser<Guid>` base class without pulling in full ASP.NET Core dependency
- Separated `UserRole` enum from `Roles` string constants class since C# enums cannot have string constant members
- Used null-safe global query filter pattern (`_tenantProvider == null || ...`) to allow DbContext to work during migrations when no tenant context exists
- Applied `FORCE ROW LEVEL SECURITY` on tenant-scoped tables so even the table owner is subject to RLS policies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Microsoft.Extensions.Identity.Stores to Domain project**
- **Found during:** Task 2 (Domain entity creation)
- **Issue:** `ApplicationUser` extends `IdentityUser<Guid>` which requires the Identity Stores package. The plan specified `Microsoft.Extensions.Identity.Core` but `IdentityUser<>` lives in `Microsoft.Extensions.Identity.Stores`.
- **Fix:** Added `Microsoft.Extensions.Identity.Stores 10.0.3` NuGet package to Domain project
- **Files modified:** src/GlobCRM.Domain/GlobCRM.Domain.csproj
- **Verification:** Build compiles with 0 errors
- **Committed in:** 38fefaa (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added .gitignore**
- **Found during:** Task 2 (before committing)
- **Issue:** No .gitignore existed, which would cause bin/, obj/, node_modules/ to be tracked
- **Fix:** Created .gitignore with .NET, Angular, IDE, and OS exclusion patterns
- **Files modified:** .gitignore
- **Verification:** `git status` no longer shows bin/obj directories
- **Committed in:** 38fefaa (Task 2 commit)

**3. [Rule 1 - Bug] Fixed UserRole string constant syntax**
- **Found during:** Task 2 (UserRole entity creation)
- **Issue:** Plan specified `public const string AdminRole = "Admin"` on the UserRole enum, but C# enums cannot have string constant members
- **Fix:** Created separate `Roles` static class with string constants (`Roles.Admin`, `Roles.Member`)
- **Files modified:** src/GlobCRM.Domain/Entities/UserRole.cs, src/GlobCRM.Domain/Entities/Invitation.cs
- **Verification:** Build compiles with 0 errors
- **Committed in:** 38fefaa (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness and clean repo management. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required for this plan. PostgreSQL setup will be needed before running migrations in Plan 03.

## Next Phase Readiness
- Solution compiles cleanly, ready for Plan 02 (if applicable) or Plan 03 (Identity/Finbuckle configuration)
- All domain entities defined with correct properties
- EF Core DbContexts ready for migration creation after Identity is configured in Program.cs
- RLS script ready to execute against PostgreSQL after tables are created

## Self-Check: PASSED

- All 23 files verified present
- Both task commits verified (ac3bb86, 38fefaa)
- Solution builds with 0 errors, 0 warnings

---
*Phase: 01-foundation*
*Completed: 2026-02-16*
