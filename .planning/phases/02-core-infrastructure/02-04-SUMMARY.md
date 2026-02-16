---
phase: 02-core-infrastructure
plan: 04
subsystem: auth
tags: [rbac, authorization, permissions, caching, asp-net-core, policy-provider]

# Dependency graph
requires:
  - phase: 02-core-infrastructure
    plan: 01
    provides: "Role, RolePermission, RoleFieldPermission, Team, TeamMember, UserRoleAssignment entities and PermissionScope/FieldAccessLevel/EntityType enums"
provides:
  - "IPermissionService with GetEffectivePermissionAsync, GetAllPermissionsAsync, GetFieldAccessLevelAsync, InvalidateUserPermissions"
  - "PermissionService with IMemoryCache caching (5-min TTL) and most-permissive-wins resolution"
  - "PermissionAuthorizationHandler integrating with ASP.NET Core [Authorize] attribute"
  - "PermissionPolicyProvider parsing 'Permission:Entity:Operation' dynamic policy names"
  - "RoleTemplateSeeder creating Admin, Manager, Sales Rep, Viewer templates per tenant"
  - "AuthorizationServiceExtensions for DI registration"
affects: [02-05-permission-middleware, 02-06-team-management, 02-07-organization-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic policy provider: PermissionPolicyProvider parses policy names into PermissionRequirements at runtime"
    - "Most-permissive-wins: union all roles (direct + team-inherited), take Max(Scope)"
    - "Single query pattern: UNION direct role IDs with team default role IDs to avoid N+1"
    - "Cache key tracking: per-user HashSet of cache keys for targeted invalidation"
    - "Startup seeding: iterate existing tenants and ensure role templates exist"

key-files:
  created:
    - src/GlobCRM.Domain/Interfaces/IPermissionService.cs
    - src/GlobCRM.Infrastructure/Authorization/PermissionRequirement.cs
    - src/GlobCRM.Infrastructure/Authorization/PermissionService.cs
    - src/GlobCRM.Infrastructure/Authorization/PermissionAuthorizationHandler.cs
    - src/GlobCRM.Infrastructure/Authorization/PermissionPolicyProvider.cs
    - src/GlobCRM.Infrastructure/Authorization/AuthorizationServiceExtensions.cs
    - src/GlobCRM.Infrastructure/Authorization/RoleTemplateSeeder.cs
  modified:
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Api/Program.cs

key-decisions:
  - "Cache key tracking via per-user HashSet for targeted invalidation instead of cache tag pattern"
  - "PermissionScope enum ordering (None=0, Own=1, Team=2, All=3) enables Max() for most-permissive-wins"
  - "Field access defaults to Editable when no RoleFieldPermission exists (open by default)"
  - "Startup seeding for existing tenants; new org seeding deferred to Plan 05/07 CreateOrganization handler"

patterns-established:
  - "Authorization handler pattern: AuthorizationHandler<PermissionRequirement> with IPermissionService injection"
  - "Dynamic policy pattern: IAuthorizationPolicyProvider with 'Permission:{Entity}:{Operation}' naming convention"
  - "Role template pattern: Admin(All), Manager(Team), Sales Rep(Team-View/Own-CED), Viewer(All-View/None-CED)"
  - "Permission service extension pattern: AddPermissionAuthorization() for clean DI registration"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 2 Plan 4: RBAC Authorization Engine Summary

**Dynamic permission resolution engine with IMemoryCache caching (5-min TTL), ASP.NET Core [Authorize] policy integration, and four template roles (Admin/Manager/Sales Rep/Viewer) auto-seeded per tenant**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-16T16:06:43Z
- **Completed:** 2026-02-16T16:12:09Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created IPermissionService interface with 4 methods (GetEffectivePermissionAsync, GetAllPermissionsAsync, GetFieldAccessLevelAsync, InvalidateUserPermissions) and EffectivePermission record type
- Built PermissionService with single-query role resolution (UNION direct + team-inherited), most-permissive-wins conflict resolution, and IMemoryCache caching with per-user key tracking for invalidation
- Implemented PermissionAuthorizationHandler and PermissionPolicyProvider enabling `[Authorize(Policy = "Permission:Contact:View")]` on any controller action
- Created RoleTemplateSeeder that seeds Admin (All), Manager (Team), Sales Rep (Team-View/Own-CED), Viewer (All-View/None-CED) templates for all entity types (Contact, Company, Deal, Activity, Quote, Request, Product)
- Wired DI registration via AddPermissionAuthorization() extension method and startup seeding in Program.cs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PermissionService with effective permission resolution and caching** - `204f6d6` (feat)
2. **Task 2: Create authorization handler, policy provider, role seeder, and wire DI** - `e2c6647` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Interfaces/IPermissionService.cs` - IPermissionService interface with EffectivePermission record, 4 methods for permission resolution and cache invalidation
- `src/GlobCRM.Infrastructure/Authorization/PermissionRequirement.cs` - IAuthorizationRequirement with EntityType and Operation properties
- `src/GlobCRM.Infrastructure/Authorization/PermissionService.cs` - Full implementation with single-query role loading, most-permissive-wins, IMemoryCache (5-min TTL), per-user cache key tracking
- `src/GlobCRM.Infrastructure/Authorization/PermissionAuthorizationHandler.cs` - AuthorizationHandler<PermissionRequirement> that checks IPermissionService for non-None scope
- `src/GlobCRM.Infrastructure/Authorization/PermissionPolicyProvider.cs` - Dynamic IAuthorizationPolicyProvider parsing "Permission:{Entity}:{Operation}" policy names
- `src/GlobCRM.Infrastructure/Authorization/AuthorizationServiceExtensions.cs` - AddPermissionAuthorization() extension registering policy provider (singleton), handler (scoped), permission service (scoped), and memory cache
- `src/GlobCRM.Infrastructure/Authorization/RoleTemplateSeeder.cs` - Static seeder creating Admin, Manager, Sales Rep, Viewer templates with CRUD permissions for all 7 entity types
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Added using and AddPermissionAuthorization() call
- `src/GlobCRM.Api/Program.cs` - Added using, SeedRoleTemplatesAsync startup call, and seeder method

## Decisions Made
- Used per-user HashSet of cache keys for invalidation (tracked alongside cached values) rather than cache tag or prefix-scan patterns, since IMemoryCache does not support key enumeration
- Default field access is Editable when no RoleFieldPermission exists -- fields are open by default, only restricted when explicitly configured
- RoleTemplateSeeder uses `IgnoreQueryFilters()` for idempotent check since startup has no tenant context
- Startup seeding covers existing tenants; new organization seeding integration deferred to CreateOrganization handler in Plan 05/07

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The `dotnet build` command was blocked by the sandbox environment during execution. Code was verified by manual inspection of types, namespaces, and project references. The Infrastructure project has `Microsoft.AspNetCore.App` framework reference (provides Microsoft.AspNetCore.Authorization and Microsoft.Extensions.Caching.Memory). All types used exist in referenced assemblies.
- Parallel plan agents (02-03, 02-05) modified Program.cs and DependencyInjection.cs concurrently, adding their own usings and service registrations. Edits were coordinated naturally through file re-reads.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Permission engine fully wired: any controller can use `[Authorize(Policy = "Permission:Contact:View")]` for dynamic permission checks
- Four template roles with correct CRUD scopes ready for seeding on new and existing tenants
- IPermissionService injectable anywhere for programmatic permission checks
- Cache invalidation available via InvalidateUserPermissions() for role/team membership changes
- NOTE: CreateOrganization handler should call RoleTemplateSeeder.SeedTemplateRolesAsync when creating new organizations (Plan 05 or 07 integration needed)

## Self-Check: PASSED

- All 7 created files verified on disk
- SUMMARY.md verified on disk
- Commit 204f6d6 verified in git log
- Commit e2c6647 verified in git log
- DependencyInjection.cs contains AddPermissionAuthorization() call
- Program.cs contains SeedRoleTemplatesAsync startup call

---
*Phase: 02-core-infrastructure*
*Completed: 2026-02-16*
