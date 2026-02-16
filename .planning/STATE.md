# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** Phase 2 (Core Infrastructure)

## Current Position

Phase: 2 of 11 (Core Infrastructure)
Plan: 9 of 12 in current phase
Status: Executing
Last activity: 2026-02-16 — Plan 02-09 complete (Angular Permission Infrastructure)

Progress: [███████░░░] 7/12 plans (Phase 2)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 7 min
- Total execution time: ~1.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 8 | ~56min | 7min |
| 02-core-infrastructure | 7 | ~49min | 7min |

**Recent Trend:**
- Last 5 plans: 01-04 (7min), 01-05 (7min), 01-06 (7min), 01-07 (8min), 01-08 (E2E verify)
- Trend: Consistent ~7min per plan

*Updated after each plan completion*
| Phase 02 P01 | 7min | 2 tasks | 18 files |
| Phase 02 P03 | 12min | 2 tasks | 12 files |
| Phase 02 P04 | 5min | 2 tasks | 9 files |
| Phase 02 P05 | 8min | 2 tasks | 9 files |
| Phase 02 P09 | 6min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Multi-tenancy: PostgreSQL with Row-Level Security for tenant isolation (triple-layer defense)
- Custom fields: JSONB storage with GIN indexing for query performance
- Stack: Angular 19 (web), .NET Core 10 (backend), PostgreSQL 17 (database), .NET MAUI (mobile)
- Authentication: Email + password with optional 2FA (SSO deferred to v2)
- Real-time: SignalR for live updates and notifications
- [01-02] @ngrx/signals v19 for Angular 19 compatibility (v21 requires Angular 21)
- [01-02] Access token in memory (signal), refresh token in localStorage only with rememberMe
- [01-02] Token refresh at 80% of expiry; uniform GlobCRM branding for Phase 1
- [Phase 01]: Used .slnx solution format (new .NET 10 default)
- [Phase 01]: Added Identity.Stores to Domain for IdentityUser base class
- [Phase 01]: FORCE ROW LEVEL SECURITY on tenant-scoped tables for defense-in-depth
- [01-04] Self-contained HTML email templates with inline CSS for email client compatibility (no Razor layout inheritance)
- [01-04] Separate DI extension methods per subsystem for parallel-safe registration
- [01-04] TenantSeeder uses seed manifest pattern -- data structure now, entity creation in Phase 3
- [Phase 01-03]: TenantDbContext extends EFCoreStoreDbContext for Finbuckle EF Core store integration
- [Phase 01-03]: JWT bearer as default auth scheme; custom login endpoint generates JWTs with organizationId claim
- [Phase 01-03]: Development mode uses WithHeaderStrategy('X-Tenant-Id') fallback for local testing without subdomains
- [01-05] Cross-tenant invitation token lookup uses IgnoreQueryFilters() since accepting user has no tenant context
- [01-08-E2E] Dual DbContext requires ExcludeFromMigrations() for shared entities to prevent duplicate tables
- [01-08-E2E] Global query filters need null tenant bypass for login/org creation to work without tenant context
- [01-08-E2E] Angular must import environment.development.ts (not environment.ts); fileReplacements swaps for production
- [01-08-E2E] Angular login uses /api/auth/login-extended (custom JWT), not /api/auth/login (Identity opaque tokens)
- [01-08-E2E] Backend runs on port 5233 (launchSettings.json), Angular dev env updated accordingly
- [02-02] JSONB value types mapped via HasColumnType('jsonb') -- not separate tables
- [02-02] Soft-delete unique constraint uses HasFilter('NOT is_deleted') for field name reuse
- [02-02] NpgsqlDataSourceBuilder with EnableDynamicJson() shared across both DbContexts
- [02-02] CustomFieldDefinition query filter combines tenant isolation AND soft-delete
- [Phase 02-01]: Child RBAC entities inherit tenant isolation via parent FK -- no TenantId or query filter needed
- [Phase 02-01]: UserPreferencesData uses explicit JSON value converter (not OwnsOne.ToJson) due to Dictionary property limitation in EF Core
- [02-03] SkiaSharp 3.119.2 for avatar processing (MIT license, free -- not ImageSharp $4999)
- [02-03] IFileStorageService abstraction with LocalFileStorageService for tenant-partitioned local storage
- [02-03] JSONB columns use System.Text.Json HasConversion for Dictionary<> property support
- [02-04] Per-user HashSet cache key tracking for targeted permission cache invalidation
- [02-04] Field access defaults to Editable when no RoleFieldPermission exists (open by default)
- [02-04] Startup seeding for existing tenants; new org seeding deferred to CreateOrganization handler
- [02-05] DI registration via separate CustomFieldServiceExtensions (Program.cs subsystem pattern)
- [02-05] CustomFieldValidator handles JsonElement values from System.Text.Json deserialization
- [02-05] Unique field validation deferred to Phase 3 when entity instances exist
- [02-05] Soft-delete restore uses IgnoreQueryFilters to bypass combined tenant+soft-delete filter
- [02-09] PermissionStore uses computed Map<string,string> for O(1) permission lookups (not array scanning)
- [02-09] Directives use effect() for reactive signal-based permission checks, avoiding per-cycle method calls
- [02-09] permissionGuard uses polling with 5s timeout to wait for PermissionStore before checking access
- [02-09] Field access defaults to fallback parameter (default: editable) when no permission defined

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 02-09-PLAN.md (Angular Permission Infrastructure)
Resume file: .planning/phases/02-core-infrastructure/02-09-SUMMARY.md
