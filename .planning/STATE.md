# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.2 Connected Experience — Phase 23 (next phase)

## Current Position

Phase: 22 of 25 (Shared Foundation + Entity Preview Sidebar) -- COMPLETE
Plan: 4 of 4 in current phase
Status: Phase Complete
Last activity: 2026-02-20 — Completed 22-04 (Feed Entity Link Preview Integration)

Progress: [███████████████████████████████████████████████████████████████████████████████████████████████████░░░░] 93% (143/153 plans)

## Milestones

- ✅ v1.0 MVP — 12 phases, 96 plans (2026-02-18)
- ✅ v1.1 Automation & Intelligence — 9 phases, 43 plans (2026-02-20)
- 🚧 v1.2 Connected Experience — 4 phases, 14 plans (in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 143
- v1.0: 96 plans across 12 phases
- v1.1: 43 plans across 9 phases
- v1.2 (in progress): 4 plans in phase 22

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

### Pending Todos

None.

### Blockers/Concerns

- Phase 24 needs schema design session during planning: DashboardScope enum, "create on first access" strategy for personal dashboards
- entity_name migration on feed_items: DONE (nullable column with backfill, applied via 22-01)

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 22-04-PLAN.md (Phase 22 complete)
Next step: Plan or execute Phase 23
