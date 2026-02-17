---
phase: 10-data-operations
plan: 03
subsystem: api
tags: [postgresql, tsvector, full-text-search, global-search, prefix-matching, rbac]

# Dependency graph
requires:
  - phase: 10-data-operations
    provides: ISearchService interface, GlobalSearchResult/SearchGroup/SearchHit DTOs, tsvector SearchVector columns on Company/Contact/Deal with GIN indexes
  - phase: 02-core-infrastructure
    provides: IPermissionService for RBAC scope resolution, ApplicationDbContext, TeamMembers navigation
  - phase: 03-core-crm-entities
    provides: Company, Contact, Deal entities with SearchVector property
provides:
  - GlobalSearchService implementing ISearchService with tsvector prefix matching and RBAC permission scoping
  - SearchController with GET /api/search?q={term}&maxPerType={5} endpoint
  - SearchServiceExtensions for DI registration
  - SearchResponse/SearchGroupDto/SearchHitDto API DTOs
affects: [10-06-frontend-search-component]

# Tech tracking
tech-stack:
  added: []
  patterns: [tsvector prefix matching with BuildPrefixQuery (term:* & term:*), per-entity RBAC scope in search service]

key-files:
  created:
    - src/GlobCRM.Infrastructure/Search/GlobalSearchService.cs
    - src/GlobCRM.Infrastructure/Search/SearchServiceExtensions.cs
    - src/GlobCRM.Api/Controllers/SearchController.cs
  modified:
    - src/GlobCRM.Api/Program.cs

key-decisions:
  - "Prefix matching via BuildPrefixQuery appending :* to each token for partial word support"
  - "Per-entity permission check (Company:View, Contact:View, Deal:View) rather than single search permission"
  - "Team member IDs materialized before query for EF Core LINQ translation compatibility"
  - "Domain DTOs used directly in service; controller maps to separate SearchResponse record DTOs"

patterns-established:
  - "tsvector prefix query pattern: split terms, append :*, join with & for AND semantics"
  - "Search service pattern: check permission per entity type, skip entity if scope=None, apply ownership filter"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 10 Plan 03: Global Search Backend Summary

**GlobalSearchService with PostgreSQL tsvector prefix matching and SearchController API returning RBAC-scoped results grouped by entity type**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T19:12:07Z
- **Completed:** 2026-02-17T19:15:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GlobalSearchService queries Company, Contact, Deal tsvector columns with prefix matching (e.g., "acm" matches "Acme")
- Results ranked by PostgreSQL tsvector Rank() for relevance ordering within each entity type
- Per-entity RBAC permission scoping (None skips entity, Own/Team/All filter ownership)
- GET /api/search?q={term}&maxPerType={5} endpoint with grouped response and totalCount

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GlobalSearchService with tsvector queries and permission scoping** - `905f746` (feat)
2. **Task 2: Create SearchController with search endpoint** - `7b9bb42` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Search/GlobalSearchService.cs` - Cross-entity search using tsvector with prefix matching, RBAC scope, team member resolution
- `src/GlobCRM.Infrastructure/Search/SearchServiceExtensions.cs` - DI registration for ISearchService -> GlobalSearchService
- `src/GlobCRM.Api/Controllers/SearchController.cs` - GET /api/search endpoint with SearchResponse/SearchGroupDto/SearchHitDto DTOs
- `src/GlobCRM.Api/Program.cs` - Added AddSearchServices() registration

## Decisions Made
- **Prefix matching strategy:** BuildPrefixQuery splits whitespace, appends `:*` to each token, joins with `&` -- gives AND semantics across partial words (e.g., "john smi" finds "John Smith")
- **Per-entity permission check:** Each entity type (Company, Contact, Deal) is checked independently via GetEffectivePermissionAsync rather than a single "Search" permission -- respects existing RBAC model
- **Team member ID materialization:** Team scope resolves member IDs to a List<Guid> before the search query for EF Core LINQ compatibility (avoids sub-query translation issues)
- **DTO mapping:** Domain GlobalSearchResult/SearchHit used in service layer; controller maps to separate record DTOs (SearchResponse/SearchGroupDto/SearchHitDto) following existing controller DTO pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Search backend complete, ready for frontend integration (10-06: global search component in navbar)
- API endpoint tested via build verification; full integration test requires running server with seed data

## Self-Check: PASSED

All created files verified on disk. All commit hashes verified in git log.

---
*Phase: 10-data-operations*
*Completed: 2026-02-17*
