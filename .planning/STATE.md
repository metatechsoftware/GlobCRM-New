# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.2 Connected Experience — Phase 22 (Shared Foundation + Entity Preview Sidebar)

## Current Position

Phase: 22 of 25 (Shared Foundation + Entity Preview Sidebar)
Plan: 1 of 4 in current phase
Status: Executing
Last activity: 2026-02-20 — Completed 22-01 (Shared Foundation)

Progress: [██████████████████████████████████████████████████████████████████████████████████████████████░░░░░░░] 91% (140/153 plans)

## Milestones

- ✅ v1.0 MVP — 12 phases, 96 plans (2026-02-18)
- ✅ v1.1 Automation & Intelligence — 9 phases, 43 plans (2026-02-20)
- 🚧 v1.2 Connected Experience — 4 phases, 14 plans (in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 139
- v1.0: 96 plans across 12 phases
- v1.1: 43 plans across 9 phases

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

### Pending Todos

None.

### Blockers/Concerns

- Phase 24 needs schema design session during planning: DashboardScope enum, "create on first access" strategy for personal dashboards
- entity_name migration on feed_items: DONE (nullable column with backfill, applied via 22-01)

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 22-01-PLAN.md
Next step: Execute 22-02-PLAN.md
