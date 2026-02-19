# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.1 Automation & Intelligence — Phase 19 gap closure (Workflow Automation)

## Current Position

Phase: 19 of 20 (Workflow Automation)
Plan: 8 of 8 complete
Status: Complete
Last activity: 2026-02-19 — Completed 19-07 (Canvas Node Projection & Template Gallery Fix)

Progress: [████████████████████████████████████████████████] 99% (v1.0: 96/96 plans, v1.1: 33/33+ Phase 13: 4/4, Phase 14: 4/4, Phase 15: 4/4, Phase 16: 4/4, Phase 17: 4/4, Phase 18: 5/5, Phase 19: 8/8)

## Performance Metrics

**Velocity:**
- Total plans completed: 96 (v1.0)
- v1.1 plans completed: 33
- v1.1 plans total: 33+ (Phase 13: 4/4, Phase 14: 4/4, Phase 15: 4/4, Phase 16: 4/4, Phase 17: 4/4, Phase 18: 5/5, Phase 19: 8/8)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 14-01 | Foundation infra + EmailTemplate data layer | 9min | 2 | 27 |
| 14-02 | Email Template API + TenantSeeder | 6min | 2 | 8 |
| 14-03 | Email Template Frontend (Unlayer + list) | 8min | 3 | 16 |
| 14-04 | Preview, Polish, Navigation | 5min | 2 | 9 |
| 15-01 | Backend Foundation (domain + NCalc engine + services) | 5min | 2 | 13 |
| 15-02 | Formula API endpoints + entity controller DTO enrichment | 8min | 2 | 9 |
| 15-03 | Formula Editor Frontend (autocomplete + validation + preview) | 4min | 2 | 7 |
| 15-04 | Formula Field Frontend Display (dynamic table + custom-field-form) | 6min | 2 | 1 |
| 16-01 | Backend Foundation (domain + pg_trgm + merge services) | 6min | 2 | 20 |
| 16-02 | API Endpoints (DuplicatesController + DuplicateSettingsController + merged redirect) | 5min | 2 | 4 |
| 16-03 | Frontend Scan & Merge UI (scan page + comparison page + confirmation dialog) | 10min | 2 | 7 |
| 16-04 | Frontend Settings & Warnings (admin rules page + form banners + merged redirects) | 8min | 2 | 7 |
| 17-01 | Webhook Domain Foundation (entities + migration + RLS + repository + DomainEvent enhancement) | 4min | 2 | 14 |
| 17-02 | Webhook Delivery Pipeline (handler + delivery service + HMAC + SSRF + retry + DI) | 4min | 2 | 7 |
| 17-03 | Webhook API Controller (11 endpoints + DTOs + validators) | 3min | 2 | 3 |
| 17-04 | Webhook Frontend Management (5 components + service + store + routes) | 7min | 2 | 10 |
| 18-01 | Email Sequence Data Layer (entities + migration + RLS + repos + seeds) | 6min | 2 | 22 |
| 18-02 | Sequence Execution Engine (Hangfire jobs + email sender + tracking + reply detection) | 5min | 2 | 9 |
| 18-03 | Sequence API Endpoints (SequencesController + 20 endpoints + DTOs + validators) | 5min | 2 | 2 |
| 18-04 | Sequence Frontend (builder + list + detail + enrollment dialog + nav) | 8min | 2 | 15 |
| 18-05 | Tracking & Analytics Dashboard (DynamicTable selection + analytics + funnel chart + enrollment) | 6min | 2 | 12 |
| 19-01 | Workflow Domain Foundation (entities + migration + RLS + repository + seeds) | 8min | 2 | 23 |
| 19-02 | Workflow Execution Engine (handler + condition eval + actions + loop guard) | 11min | 2 | 15 |
| 19-03 | Workflow REST API (17 endpoints + DTOs + validators + date trigger scanner) | 9min | 2 | 12 |
| 19-04 | Workflow Frontend (models + service + store + card grid list + SVG thumbnails) | 6min | 2 | 14 |
| 19-05 | Workflow Visual Builder (@foblex/flow canvas + node components) | 7min | 2 | 8 |
| 19-06 | Workflow Detail & Execution Logs (detail page + log list + log detail) | 8min | 2 | 7 |
| 19-07 | Canvas Node Projection & Template Gallery Fix (gap closure) | 4min | 2 | 2 |
| 19-08 | Permission Reload After Token Refresh (auth interceptor gap closure) | 2min | 1 | 1 |

**v1.0 Summary:** 12 phases, 96 plans, ~124,200 LOC shipped in 3 days
| Phase 19 P05 | 11min | 2 tasks | 15 files |
| Phase 19-07 PCanvas Node Projection & Template Gallery Fix | 4min | 2 tasks | 2 files |

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
- [15-03] Autocomplete positioned relative to formula-editor container (not cursor) for simplicity
- [15-03] Validation+preview run sequentially -- preview only fires after validation passes
- [15-03] Validation rules panel hidden for Formula type fields (required/unique/min/max not applicable)
- [15-03] FormulaEditorComponent uses output() signals; parent dialog owns save logic
- [15-04] Formula fields skip FormControl creation entirely -- cleaner separation of computed vs. editable
- [15-04] Formula value lookup checks field.name then field.id fallback to match API response shape
- [16-01] Two-tier detection: pg_trgm GIN-indexed pre-filter at 50% threshold, FuzzySharp weighted scoring in-memory
- [16-01] Contact scoring: name 50% + email 50% (redistributed when field missing); Company: name 60% + domain 40%
- [16-01] Merge via explicit BeginTransactionAsync/CommitAsync; ExecuteUpdateAsync for bulk FK transfers
- [16-01] Merged records excluded via global query filter (MergedIntoId == null) -- IgnoreQueryFilters for redirect
- [16-01] Composite PK deduplication: query survivor links, remove conflicting loser links, update rest
- [16-02] DuplicatePairDto uses object-typed RecordA/RecordB for polymorphic contact/company match DTOs
- [16-02] Merged-record redirect returns 200 with {isMerged, mergedIntoId} instead of 301 for simpler Angular handling
- [16-02] DuplicateSettingsController auto-creates default configs (threshold 70, auto-detection on) on first access
- [16-02] Comparison endpoints use IgnoreQueryFilters to load even recently merged records
- [16-03] Scan and merge pages separate routes with query param handoff (entityType, id1, id2) -- not a single wizard
- [16-03] Field comparison uses computed signal with runtime diff detection -- amber highlighting for differences
- [16-03] Primary record auto-selected by updatedAt comparison, swappable via click or swap button
- [16-03] Contact vs Company observable branches separated to avoid TypeScript union type subscribe incompatibility
- [16-04] Duplicate check fires on field blur (not debounced keystrokes) with value deduplication to avoid redundant API calls
- [16-04] Warning banners positioned above form grid, amber styling, dismissible, reset dismissed state on new field values
- [16-04] Merged-record redirect checks response shape (isMerged + mergedIntoId) with any type cast for simplicity
- [16-04] DuplicateRulesComponent uses mutable EntityRuleConfig objects with signal update spread for OnPush change detection
- [17-01] DomainEvent OldPropertyValues nullable with default null -- backward compatible for existing Created/Deleted consumers
- [17-01] EventSubscriptions stored as JSONB List<string> with "Entity.EventType" format (e.g., "Contact.Created")
- [17-01] RequestPayload stored as text (not JSONB) to preserve exact serialization for HMAC signature fidelity
- [17-01] GetSubscriptionsForEventAsync loads active subscriptions then filters in-memory for JSONB contains
- [17-01] Composite index on (tenant_id, is_active, is_disabled) for subscription matching query optimization
- [17-02] Payload builder uses explicit per-entity property mapping (not DTOs) for stable webhook API contracts
- [17-02] SSRF validator uses System.Net.IPNetwork for CIDR matching with fresh DNS resolution per delivery
- [17-02] 429 Too Many Requests treated as retryable; other 4xx are permanent errors (no retry)
- [17-02] Subscription cache: IMemoryCache with 60-second TTL keyed by tenant ID, InvalidateCache for CRUD
- [17-03] GetAllSubscriptionsAsync added to repository -- admin listing needs all subscriptions including disabled
- [17-03] Secret masked as whsec_****...{last4} in GET responses; full secret only on POST create and regenerate-secret
- [17-03] Test webhook two-step flow: preview=true returns sample payload, preview=false enqueues real Hangfire delivery
- [17-03] Manual retry validates failed status, subscription existence, active state, and non-disabled state
- [17-04] Angular @if...as alias only on primary @if blocks, not @else if -- separate @if blocks for template type narrowing
- [17-04] WebhookStore component-provided (not root) -- each webhook page gets fresh state instance
- [17-04] Secret dialog shared between create and regenerate flows -- same WebhookSecretDialogComponent
- [17-04] Delivery log expandable rows use signal-based Set<string> for OnPush-compatible expanded row tracking
- [17-04] Global delivery log subscription filter uses direct service call (not store) to avoid coupling filter with log state
- [18-01] EmailSequenceStep FK to EmailTemplate uses Restrict delete -- prevents template deletion while used by active sequences
- [18-01] SequenceEnrollment uses timestamp fields (RepliedAt, PausedAt, BouncedAt, CompletedAt) as audit trail rather than separate history table
- [18-01] StepMetrics record type in ISequenceEnrollmentRepository for per-step analytics aggregation
- [18-01] Composite unique index on (sequence_id, step_number) for step ordering integrity
- [18-02] SequenceEmailSender attempts Gmail first (custom headers for reply detection), falls back to SendGrid (no reply detection)
- [18-02] EmailTrackingService uses base64url of enrollmentId:stepNumber for tokens (not crypto-secure by design)
- [18-02] Open tracking deduplicated per enrollment+step (unique opens), click tracking allows multiples (each click is valuable)
- [18-02] Reply detection uses GmailThreadId matching against sent SequenceTrackingEvents (not custom header parsing on inbound)
- [18-02] TrackingController returns pixel/redirect even on tracking failure (graceful degradation)
- [18-03] CalculateDelay changed from internal to public static for controller resume endpoint reuse
- [18-03] RBAC permissions for EmailSequence auto-handled by existing RoleTemplateSeeder + PermissionPolicyProvider (zero code changes)
- [18-03] 20 API endpoints including bulk-pause/resume for multi-select enrollment management
- [18-04] SequenceStore component-provided (not root) following WebhookStore pattern -- each page gets fresh state
- [18-04] Sequence list uses mat-table (not DynamicTable) since sequences have fixed columns without user-configurable custom fields
- [18-04] Separate @if blocks instead of @else if...as for Angular template compatibility (same limitation found in 17-04)
- [18-05] DynamicTable selection is fully generic -- no sequence-specific code; usable by any entity list page via enableSelection input
- [18-05] SequencePickerDialog lazy-imported via dynamic import() from contacts list and contact detail to avoid eagerly loading sequence module
- [18-05] Contact detail uses mat-menu more_vert trigger for "Enroll in Sequence" action -- keeps header clean, extensible for future actions
- [19-01] WorkflowDefinition stored as JSONB owned entity via ToJson() with nested OwnsMany for nodes/connections/triggers/conditions/actions
- [19-01] WorkflowActionConfig.Config and WorkflowNode.Config stored as string (serialized JSON) instead of Dictionary -- EF Core ToJson() doesn't support nested dictionaries in owned types
- [19-01] TriggerSummary denormalized List<string> on Workflow entity for fast event matching without full definition deserialization
- [19-02] WorkflowTriggerContext as positional record with primitive/string types for Hangfire serialization safety
- [19-02] Branch node evaluation returns bool mapped to "yes"/"no" connection SourceOutput for graph traversal
- [19-02] Wait nodes schedule continuation as separate Hangfire delayed jobs and halt current traversal
- [19-02] Loop guard depth passed through Hangfire job parameters since AsyncLocal does not survive serialization
- [19-02] Entity data loaded fresh in execution service (not from domain event) to get complete entity state
- [19-02] Action implementations reuse existing infrastructure services exclusively -- no new service layer
- [19-03] IMemoryCache direct injection in WorkflowsController for cache invalidation -- avoids compile-time dependency on WorkflowDomainEventHandler from parallel 19-02
- [19-03] Stub action classes created for parallel 19-02 build compatibility -- 19-02 replaces with real implementations
- [19-03] DateTriggerScanService supports Deal.ExpectedCloseDate and Activity.DueDate; custom field date querying deferred
- [19-03] NotificationType.WorkflowAction added proactively for 19-02 SendNotificationAction compatibility
- [19-04] SVG schematic thumbnail approach 2 -- renders from triggerSummary.length and nodeCount without full definition (no backend change)
- [19-04] Placeholder components for builder/detail/logs routes -- Angular compiler resolves lazy-loaded paths at compile time
- [19-04] WorkflowStore component-provided (not root) following WebhookStore/SequenceStore pattern -- each page gets fresh instance
- [19-04] Optimistic status toggle with revert-on-error pattern for responsive UX
- [19-06] All 19-06 components created during 19-05 execution as build dependency (Rule 3) -- verified correct and complete
- [19-06] ExecutionLogListComponent dual-input pattern (workflowId for embedded, id for routed) with computed resolver
- [19-06] Action timeline uses vertical left-aligned layout with status dots, halt markers, and unreached action count
- [Phase 19]: @foblex/flow FFlowModule single import pattern for all canvas directives; branch dual output_yes/output_no connectors; ActionConfigComponent shared for action+wait nodes
- [19-07] Inline fNode templates as direct children of f-canvas -- Angular content projection only matches direct children, wrapper components break ng-content select
- [19-07] Template gallery loads all templates without entityType filter -- sorts matching entity type first locally for relevance
- [19-08] Fire-and-forget loadPermissions() in auth interceptor 401-retry path -- does not block request retry since JWT already valid and permissions update reactively via signals

### Pending Todos

None.

### Blockers/Concerns

- @foblex/flow Angular 19.2.x compatibility unverified — fallback is linear form builder (decision needed before Phase 19 planning)
- DomainEventInterceptor ordering resolved in 14-01: Auditable first (sets timestamps), DomainEvent second (captures final state)
- Gmail reply detection accuracy for sequence auto-unenroll (Phase 18) — RESOLVED: GmailThreadId matching with enrollment status guard and Hangfire job cancellation
- Complete FK reference map implemented in 16-01: Contact 12 refs, Company 13 refs transferred in merge services

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 19-07-PLAN.md (Canvas Node Projection & Template Gallery Fix)
Resume file: .planning/phases/19-workflow-automation/19-07-SUMMARY.md
Next step: Phase 19 gap closure complete (all 8 plans done) -- proceed to Phase 20 or final UAT
