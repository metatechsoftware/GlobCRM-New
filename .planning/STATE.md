# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** Phase 1 (Foundation)

## Current Position

Phase: 1 of 11 (Foundation)
Plan: 7 of 8 in current phase
Status: Executing
Last activity: 2026-02-16 — Completed 01-06-PLAN.md

Progress: [███████░░░] 6/8 plans

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 7 min
- Total execution time: 0.70 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 6 | 42min | 7min |

**Recent Trend:**
- Last 5 plans: 01-02 (6min), 01-03 (~7min), 01-04 (7min), 01-05 (7min), 01-06 (7min)
- Trend: Consistent ~7min per plan

*Updated after each plan completion*

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
- [01-04] Separate DI extension methods per subsystem (EmailServiceExtensions, OrganizationServiceExtensions) for parallel-safe registration
- [01-04] TenantSeeder uses seed manifest pattern -- data structure now, entity creation in Phase 3
- [01-04] Reserved subdomain list includes infrastructure (www, api, cdn) and product names (app, dashboard, console)
- [Phase 01-03]: TenantDbContext extends EFCoreStoreDbContext for Finbuckle EF Core store integration
- [Phase 01-03]: JWT bearer as default auth scheme; custom login endpoint generates JWTs with organizationId claim
- [Phase 01-03]: Development mode uses WithHeaderStrategy('X-Tenant-Id') fallback for local testing without subdomains
- [01-05] Cross-tenant invitation token lookup uses IgnoreQueryFilters() since accepting user has no tenant context
- [01-05] LogoutEndpoint in Api project (not Application) due to HttpContext/IResult dependency
- [01-05] Application layer avoids EF Core dependency: uses FindByEmailAsync and synchronous IQueryable.Count()
- [01-05] InvitationServiceExtensions follows per-subsystem DI pattern; all services registered in Program.cs
- [01-06] Auth pages use pages/ subdirectory structure from Plan 02 scaffolding (not flat structure)
- [01-06] Password strength: 4-tier scoring (length, uppercase, digits, special chars) with color-coded mat-progress-bar
- [01-06] Forgot password always shows success to prevent email enumeration
- [01-06] Verify email handles both pending and confirmation states in single component via query params

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 01-06-PLAN.md
Resume file: .planning/phases/01-foundation/01-06-SUMMARY.md
