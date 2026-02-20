# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.2 Connected Experience — Phase 24 in progress

## Current Position

Phase: 24 of 25 (My Day Personal Dashboard)
Plan: 3 of 5 in current phase -- COMPLETE
Status: Executing phase 24
Last activity: 2026-02-20 — Completed 24-03 (My Day Core Widgets)

Progress: [███████████████████████████████████████████████████████████████████████████████████████████████████████░░] 98% (152/155 plans)

## Milestones

- ✅ v1.0 MVP — 12 phases, 96 plans (2026-02-18)
- ✅ v1.1 Automation & Intelligence — 9 phases, 43 plans (2026-02-20)
- 🚧 v1.2 Connected Experience — 4 phases, 14 plans (in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 152
- v1.0: 96 plans across 12 phases
- v1.1: 43 plans across 9 phases
- v1.2 (in progress): 13 plans (5 in phase 22, 5 in phase 23, 3 in phase 24)

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table and archived in milestones/.

Recent decisions for v1.2:
- Preview sidebar must come first (other features reference its quick actions pattern)
- Tab index refactor (index-based to label-based) is prerequisite for safe Summary tab insertion
- Summary tabs use single batched aggregation endpoints (not N+1 individual calls)
- My Day has FIXED layout (user deferred configurable gridster drag-and-drop to v1.3+)
- Zero new packages needed for v1.2
- EntityTypeRegistry as pure constant map (not injectable service) for tree-shaking
- EntityName backfill via raw SQL JOINs in migration Up method
- ShowInPreview uses nullable bool on update requests for partial update semantics
- Preview endpoint uses per-type internal RBAC (no blanket policy attribute) for cross-entity access
- Activity preview checks both OwnerId and AssignedToId; Product preview skips scope check
- AppComponent uses mat-sidenav-container with mode=side for push-content preview sidebar at 480px
- Preview sidebar store uses navigation stack with max depth 10 and cap-and-trim strategy
- Feed entity links: normal click opens preview sidebar, Ctrl/Cmd+click navigates to detail page
- Feed tooltips use denormalized entityName (no API call on hover)
- Material chip hover uses CSS custom properties (--mdc-chip-elevated-container-color) not direct background
- Sidebar container below fixed header uses margin-top + calc height, not padding-top
- Entity-prefixed DTO names for summary endpoints to avoid namespace collisions (co-located per controller file)
- Win rate computed from materialized deal data, not separate SQL query
- Request summary uses dual-ownership RBAC (OwnerId + AssignedToId)
- Shared frontend summary interfaces (SummaryActivityDto etc.) instead of entity-prefixed since shapes are identical
- Computed signals for type narrowing in EntitySummaryTabComponent @switch blocks
- StageInfoDto adapter pattern for MiniStageBarComponent reuse in summary tabs
- CSS conic-gradient donut chart with radial-gradient mask for donut hole (zero-dependency chart visualization)
- Activities as hero content with full-width card and two distinct sections (Recent + Upcoming with accent border)
- Deal count for donut segment proportions (not value) for clearer visual pipeline distribution
- NoteFormComponent uses MAT_DIALOG_DATA with optional injection for dual-mode operation (standalone route and dialog)
- Quick actions call loadSummary() directly in afterClosed handler for immediate user feedback
- Quote and Request keep raw mat-tab-group with selectedIndex binding (not refactored to RelatedEntityTabsComponent)
- Summary dirty-flag set on status transitions for Quote and Request
- No Company detail changes needed for dirty-flag -- no inline sibling-tab mutations exist
- Route ordering: auth, onboarding, my-day, analytics, settings, entity routes, redirects
- Backward compat: /dashboard redirects to /analytics (not removed)
- Sequential await for all My Day EF Core queries (DbContext not thread-safe)
- Pipeline grouping in memory after Include(d => d.Stage) to avoid EF GroupBy translation issues
- RecentlyViewedEntity upsert via unique index on (tenant_id, user_id, entity_type, entity_id)
- PreviewEntityLinkComponent enhanced globally for Ctrl/Cmd+click — benefits all entity links app-wide
- Widget components use PreviewEntityLinkComponent directly for entity links rather than emitting events to parent

### Pending Todos

None.

### Blockers/Concerns

- Phase 24 needs schema design session during planning: DashboardScope enum, "create on first access" strategy for personal dashboards
- entity_name migration on feed_items: DONE (nullable column with backfill, applied via 22-01)

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 24-03-PLAN.md
Resume file: .planning/phases/24-my-day-personal-dashboard/24-03-SUMMARY.md
Next step: Execute 24-04-PLAN.md (My Day remaining widgets)
