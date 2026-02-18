# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.1 Automation & Intelligence — Phase 13 (Leads)

## Current Position

Phase: 13 of 20 (Leads)
Plan: 3 of 4 complete
Status: Executing
Last activity: 2026-02-18 — Completed 13-03 (Lead Angular frontend)

Progress: [██████████████████████████░░░░░░░░░░░░░░] 65% (v1.0: 96/96 plans, v1.1: 3 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 96 (v1.0)
- v1.1 plans completed: 3
- v1.1 plans total: 4+ (Phase 13: 4 plans)

**v1.0 Summary:** 12 phases, 96 plans, ~124,200 LOC shipped in 3 days

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- [v1.1] Features designed as connected system — workflows trigger emails/webhooks, reports use computed fields
- [v1.1] Workflows phase comes late (Phase 19) because it orchestrates all other automation features (email templates, webhooks, sequences)
- [v1.1] DomainEventInterceptor built in Phase 14 (Foundation) — shared by webhooks, workflows, and duplicate detection
- [v1.1] Leads first (Phase 13) — follows established v1.0 CRUD patterns, quick win before new infrastructure
- [v1.1] Hangfire with PostgreSQL storage — no Redis needed at current scale
- [13-01] LeadStage separate from PipelineStage -- simpler model without probability/required-fields
- [13-01] Lead.CompanyName is string (not FK) -- leads may reference non-existent companies
- [13-01] LeadConversion one-to-one with Lead via unique index on LeadId
- [13-02] Conversion uses direct DbContext operations for single-SaveChangesAsync atomicity across Contact/Company/Deal/LeadConversion
- [13-02] LeadSource DELETE sets referencing leads' SourceId to null (matching FK SET NULL behavior)
- [13-02] Reused NotificationType.DealStageChanged for lead stage notifications (avoids migration)
- [13-03] Kanban groups leads client-side from flat API response via computed signal (stagesWithLeads)
- [13-03] Forward-only drag enforcement done client-side by SortOrder comparison before API call
- [13-03] Converted stage drop rejected entirely -- users must use Convert Lead action on detail page

### Pending Todos

None.

### Blockers/Concerns

- @foblex/flow Angular 19.2.x compatibility unverified — fallback is linear form builder (decision needed before Phase 19 planning)
- DomainEventInterceptor ordering with existing AuditableEntityInterceptor needs integration testing in Phase 14
- Gmail reply detection accuracy for sequence auto-unenroll (Phase 18) — false positive/negative handling needs explicit design
- Complete FK reference map needed before Phase 16 (Duplicate Merge) implementation to avoid data loss

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 13-03-PLAN.md (Lead Angular frontend)
Resume file: .planning/phases/13-leads/13-03-SUMMARY.md
Next step: Execute 13-04-PLAN.md (Lead detail, form, conversion UI)
