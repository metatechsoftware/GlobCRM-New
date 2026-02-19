# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.1 Automation & Intelligence — Phase 14 in progress

## Current Position

Phase: 14 of 20 (Foundation Infrastructure & Email Templates) -- IN PROGRESS
Plan: 3 of 4 complete
Status: Executing
Last activity: 2026-02-19 — Completed 14-03 (Email Template Frontend)

Progress: [████████████████████████████████░░░░░░░░░░] 74% (v1.0: 96/96 plans, v1.1: 7/8+ Phase 13: 4/4, Phase 14: 3/4)

## Performance Metrics

**Velocity:**
- Total plans completed: 96 (v1.0)
- v1.1 plans completed: 7
- v1.1 plans total: 8+ (Phase 13: 4/4, Phase 14: 3/4)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 14-01 | Foundation infra + EmailTemplate data layer | 9min | 2 | 27 |
| 14-02 | Email Template API + TenantSeeder | 6min | 2 | 8 |
| 14-03 | Email Template Frontend (Unlayer + list) | 8min | 3 | 16 |

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
- [13-04] Custom horizontal stepper (not MatStepper) for lead pipeline visualization -- full control over stage colors, icons, forward-only click
- [13-04] Conversion dialog uses sectioned form (not multi-step wizard) -- simpler UX with Contact/Company/Deal sections in single view
- [13-04] Duplicate check on dialog open shows informational warnings only -- actual dedup merge deferred to Phase 16
- [13-04] Company section in conversion dialog offers both link-existing (autocomplete) and create-new options
- [14-01] DomainEventInterceptor uses AsyncLocal for pending events, dispatches after SaveChanges with fire-and-forget
- [14-01] Interceptor chain: TenantDbConnection -> Auditable -> DomainEvent (order matters for final state capture)
- [14-01] TenantProvider 3-level fallback: Finbuckle -> JWT claim -> TenantScope AsyncLocal
- [14-01] TemplateRenderService singleton (FluidParser thread-safe), EmailTemplateRepository scoped
- [14-01] EmailTemplate.DesignJson as JSONB, HtmlBody as text column
- [14-02] SendRawEmailAsync added to IEmailService for generic HTML delivery (test sends, future sequences)
- [14-02] Preview endpoint uses sample placeholder data when no entity specified, real entity data with EntityType+EntityId
- [14-02] Hangfire dashboard: open in dev, Admin role required in prod
- [14-03] Unlayer merge tags use color property per entity group for color-coded pill rendering
- [14-03] Template list uses card grid with iframe srcdoc thumbnails (not DynamicTable)
- [14-03] Merge field panel is supplementary browser with copy-to-clipboard; primary insertion via Unlayer toolbar
- [14-03] Editor stores both design JSON (for re-editing) and compiled HTML (for rendering)

### Pending Todos

None.

### Blockers/Concerns

- @foblex/flow Angular 19.2.x compatibility unverified — fallback is linear form builder (decision needed before Phase 19 planning)
- DomainEventInterceptor ordering resolved in 14-01: Auditable first (sets timestamps), DomainEvent second (captures final state)
- Gmail reply detection accuracy for sequence auto-unenroll (Phase 18) — false positive/negative handling needs explicit design
- Complete FK reference map needed before Phase 16 (Duplicate Merge) implementation to avoid data loss

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 14-03-PLAN.md
Resume file: .planning/phases/14-foundation-infrastructure-email-templates/14-03-SUMMARY.md
Next step: Execute 14-04-PLAN.md (Navigation, Polish, Testing)
