---
phase: 02-core-infrastructure
plan: 09
subsystem: auth
tags: [angular, ngrx-signals, permissions, rbac, directives, guards, reactive]

# Dependency graph
requires:
  - phase: 02-04
    provides: "Backend RBAC engine with role/team/permission models and authorization service"
  - phase: 02-07
    provides: "Angular notification service and SignalR integration patterns"
provides:
  - "PermissionStore: signal-based reactive permission store with O(1) lookups"
  - "PermissionService: full CRUD API client for roles, teams, and permission queries"
  - "HasPermissionDirective: structural directive for conditional UI rendering based on entity permissions"
  - "FieldAccessDirective: attribute directive for field-level hidden/readonly/editable access control"
  - "permissionGuard: factory function returning CanActivateFn for route-level permission protection"
  - "Auth flow integration: permissions loaded after login/refresh, cleared on logout"
affects: [02-10, 03-entity-pages, 03-settings-pages]

# Tech tracking
tech-stack:
  added: []
  patterns: [signal-store-permission-map, structural-directive-with-effect, factory-guard-pattern, field-access-directive]

key-files:
  created:
    - globcrm-web/src/app/core/permissions/permission.models.ts
    - globcrm-web/src/app/core/permissions/permission.service.ts
    - globcrm-web/src/app/core/permissions/permission.store.ts
    - globcrm-web/src/app/core/permissions/has-permission.directive.ts
    - globcrm-web/src/app/core/permissions/permission.guard.ts
    - globcrm-web/src/app/shared/directives/field-access.directive.ts
  modified:
    - globcrm-web/src/app/core/auth/auth.service.ts

key-decisions:
  - "PermissionStore uses computed Map<string,string> for O(1) permission lookups instead of array scanning"
  - "Directives use effect() for reactive signal-based permission checks, avoiding per-cycle method calls"
  - "permissionGuard uses polling with 5s timeout to wait for PermissionStore to load before checking access"
  - "Field access defaults to fallback parameter (default: editable) when no permission defined"

patterns-established:
  - "Permission map pattern: computed Map from permissions array for O(1) entity:operation lookups"
  - "Structural directive with effect: *appHasPermission uses effect() to reactively show/hide elements"
  - "Factory guard pattern: permissionGuard(entity, op) returns CanActivateFn for declarative route protection"
  - "Field access directive: [appFieldAccess] with Renderer2 for hidden/readonly/editable host element control"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 2 Plan 9: Angular Permission Infrastructure Summary

**Signal-based PermissionStore with HasPermission structural directive, FieldAccess attribute directive, and permissionGuard factory for reactive frontend RBAC enforcement**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-16
- **Completed:** 2026-02-16
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- PermissionStore with @ngrx/signals pattern: computed permissionMap and fieldPermissionMap for O(1) lookups, async loadPermissions/loadFieldPermissions
- HasPermissionDirective (*appHasPermission="'Entity:Op'") for conditional rendering using effect() reactive signals
- FieldAccessDirective ([appFieldAccess]="'Entity:Field'") applying hidden/readonly/editable states via Renderer2
- permissionGuard factory function returning CanActivateFn with async wait-for-load and dashboard redirect
- Auth flow integration: PermissionStore.loadPermissions() called in handleLoginSuccess, clear() called on logout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PermissionService, PermissionStore, and permission models** - `b299aa1` (feat)
2. **Task 2: Create HasPermission directive, FieldAccess directive, and PermissionGuard** - `3f759ed` (feat)

## Files Created/Modified
- `globcrm-web/src/app/core/permissions/permission.models.ts` - EffectivePermission, FieldPermission, Role/Team DTOs, and request types
- `globcrm-web/src/app/core/permissions/permission.service.ts` - Full CRUD API client for roles, teams, and user permission queries
- `globcrm-web/src/app/core/permissions/permission.store.ts` - Signal store with computed permission/field maps, load/check/clear methods
- `globcrm-web/src/app/core/permissions/has-permission.directive.ts` - Structural directive for permission-based conditional rendering
- `globcrm-web/src/app/core/permissions/permission.guard.ts` - Factory guard function for route-level permission checks
- `globcrm-web/src/app/shared/directives/field-access.directive.ts` - Attribute directive for field-level hidden/readonly/editable access
- `globcrm-web/src/app/core/auth/auth.service.ts` - Added PermissionStore integration (load after login, clear on logout)

## Decisions Made
- PermissionStore uses computed `Map<string,string>` for O(1) permission lookups rather than linear scanning through the permissions array on each check
- All directives use `effect()` from Angular signals for reactive permission checks, avoiding method calls per change detection cycle (addresses research pitfall #7)
- permissionGuard polls PermissionStore.isLoaded() with 100ms intervals up to 5 seconds, then allows access on timeout (graceful degradation)
- Field access defaults to fallback parameter (default: 'editable') when no field permission exists, following the open-by-default pattern established in 02-04
- Added TeamDetailDto, TeamMemberDto, CreateRoleRequest, UpdateRoleRequest, CreateTeamRequest, UpdateTeamRequest to models (needed for complete service interface)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Permission infrastructure ready for Plan 10 (Roles & Teams management UI)
- HasPermissionDirective and FieldAccessDirective ready for use in Phase 3 entity pages
- permissionGuard ready for route protection in entity and settings routes
- Field permission loading (loadFieldPermissions) available but deferred to Phase 3 when entity pages are built

## Self-Check: PASSED

- FOUND: globcrm-web/src/app/core/permissions/permission.models.ts
- FOUND: globcrm-web/src/app/core/permissions/permission.service.ts
- FOUND: globcrm-web/src/app/core/permissions/permission.store.ts
- FOUND: globcrm-web/src/app/core/permissions/has-permission.directive.ts
- FOUND: globcrm-web/src/app/core/permissions/permission.guard.ts
- FOUND: globcrm-web/src/app/shared/directives/field-access.directive.ts
- FOUND: .planning/phases/02-core-infrastructure/02-09-SUMMARY.md
- FOUND commit: b299aa1 (Task 1)
- FOUND commit: 3f759ed (Task 2)

---
*Phase: 02-core-infrastructure*
*Plan: 09*
*Completed: 2026-02-16*
