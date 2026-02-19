# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.1 Automation & Intelligence — Phase 15 in progress

## Current Position

Phase: 15 of 20 (Formula / Computed Custom Fields)
Plan: 2 of 4 complete
Status: In Progress
Last activity: 2026-02-19 — Completed 15-02 (Formula API Endpoints)

Progress: [████████████████████████████████████░░░░░░] 80% (v1.0: 96/96 plans, v1.1: 10/12+ Phase 13: 4/4, Phase 14: 4/4, Phase 15: 2/4)

## Performance Metrics

**Velocity:**
- Total plans completed: 96 (v1.0)
- v1.1 plans completed: 10
- v1.1 plans total: 12+ (Phase 13: 4/4, Phase 14: 4/4, Phase 15: 2/4)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 14-01 | Foundation infra + EmailTemplate data layer | 9min | 2 | 27 |
| 14-02 | Email Template API + TenantSeeder | 6min | 2 | 8 |
| 14-03 | Email Template Frontend (Unlayer + list) | 8min | 3 | 16 |
| 14-04 | Preview, Polish, Navigation | 5min | 2 | 9 |
| 15-01 | Backend Foundation (domain + NCalc engine + services) | 5min | 2 | 13 |
| 15-02 | Formula API endpoints + entity controller DTO enrichment | 8min | 2 | 9 |

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
- [14-04] Preview dialog uses iframe sandbox+srcdoc for safe rendered HTML display
- [14-04] Entity search uses ApiService directly (not per-entity services) to avoid coupling
- [14-04] Email Templates nav item in Connect group after Emails; route guards for access control
- [15-01] NCalcSync v5.11.0 for formula evaluation -- EvaluateFunction event handler pattern for custom functions
- [15-01] Field references: camelCase system fields, snake_case custom fields -- no GUID references in formulas
- [15-01] FormulaResultType admin-selected (number/text/date) -- explicit display formatting control
- [15-01] DependsOnFieldIds stores field names for dependency tracking and topological sort
- [15-01] Formula services (evaluation, validation, registry) registered via AddFormulaFieldServices() from AddCustomFieldServices()
- [15-02] Optional parameter pattern on FromEntity for backward compat -- enrichedCustomFields ?? entity.CustomFields
- [15-02] Only Deals/Activities list DTOs enriched (they expose CustomFields); other entities detail-only
- [15-02] DependsOnFieldIds extracted via NCalc GetParameterNames() during Create/Update

### Pending Todos

None.

### Blockers/Concerns

- @foblex/flow Angular 19.2.x compatibility unverified — fallback is linear form builder (decision needed before Phase 19 planning)
- DomainEventInterceptor ordering resolved in 14-01: Auditable first (sets timestamps), DomainEvent second (captures final state)
- Gmail reply detection accuracy for sequence auto-unenroll (Phase 18) — false positive/negative handling needs explicit design
- Complete FK reference map needed before Phase 16 (Duplicate Merge) implementation to avoid data loss

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 15-02-PLAN.md
Resume file: .planning/phases/15-formula-computed-custom-fields/15-02-SUMMARY.md
Next step: Execute 15-03-PLAN.md (Angular frontend formula components)
