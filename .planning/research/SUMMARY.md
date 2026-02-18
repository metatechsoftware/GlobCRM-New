# Project Research Summary

**Project:** GlobCRM v1.1 — Automation, Intelligence, and Extensibility
**Domain:** Multi-Tenant SaaS CRM Automation (Workflow Engine, Email Sequences, Formula Fields, Duplicate Detection, Webhooks, Advanced Reporting)
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

GlobCRM v1.1 transforms the shipped v1.0 CRUD-focused CRM into an automation-first platform. The core architectural shift is from request/response data management to event-driven processing: entity changes become the universal trigger for workflows, webhooks, formula recalculation, and duplicate detection. All six v1.1 feature areas are interconnected through a shared infrastructure — a domain event interceptor hooked into EF Core's `SaveChangesAsync` pipeline, and Hangfire for durable background processing. The existing Clean Architecture (Angular 19 / .NET 10 / PostgreSQL 17) remains unchanged; v1.1 plugs into existing layers rather than replacing them.

The recommended approach is to build foundational infrastructure first (Hangfire job server + email template renderer + formula evaluator), then layer higher-order features on top. Email Templates and Formula Fields are independent leaf nodes that everything else depends on. Workflow Automation is the orchestration hub that connects templates, sequences, webhooks, and notifications. This dependency order dictates a natural phase structure: foundation first, then the automation engine, then sequences/webhooks in parallel, then duplicate detection (most complex data mutation), and finally the reporting builder (benefits from all preceding data). The stack additions are minimal: 5 NuGet packages and 1 npm package on top of the existing 17 NuGet packages.

The primary risks are cross-cutting and architectural. Tenant context must be explicitly propagated into all background jobs or catastrophic cross-tenant data leakage occurs. Workflow engines that do not track execution depth create infinite loops that exhaust system resources across all tenants. Merge operations that miss FK references permanently destroy contact history. None of these risks are recoverable without data loss — they must be designed in from the start, not bolted on later. The research is unanimous: implement the `TenantScope` job wrapper and the workflow depth limiter before writing any feature-specific code.

## Key Findings

### Recommended Stack

The existing .NET 10 / Angular 19 / PostgreSQL 17 stack handles all v1.1 needs with only targeted additions. No architectural changes are required. The five NuGet additions are: **Hangfire** (PostgreSQL-backed durable job processing for delayed scheduling, retry, and monitoring), **Fluid.Core** (sandboxed Liquid template engine for user-editable email templates — RazorLight stays for system emails only), **NCalcSync** (expression evaluator for formula fields and workflow conditions), **FuzzySharp** (in-memory fuzzy string scoring for duplicate detection candidates), and **Microsoft.Extensions.Http.Resilience** (Polly-based resilient HTTP for webhook delivery). On the frontend, **@foblex/flow** provides the Angular-native visual workflow builder canvas.

**Core technology additions:**
- **Hangfire 1.8.23 (PostgreSQL storage)**: Durable background jobs — the backbone of all async processing. Required for delayed email sequence steps, webhook retry with backoff, workflow action execution, and nightly duplicate scans. Uses existing PostgreSQL database, no new infrastructure.
- **Fluid.Core 2.31.0**: Liquid template engine for user-authored email templates. Sandboxed by design (no C# injection). 8x faster than DotLiquid. Coexists with RazorLight (system emails unchanged).
- **NCalcSync 5.11.0**: Expression evaluator for formula fields (`[deal_value] * [probability]`) and workflow conditions (`[stage] == 'Won' && [value] > 10000`). Pure computation, no external dependencies. Placed in Application layer.
- **FuzzySharp 2.0.2 + pg_trgm (built-in)**: Two-tier duplicate detection: PostgreSQL `pg_trgm` GIN indexes pre-filter candidates at database level; FuzzySharp computes weighted composite scores (name: 40%, email: 30%, phone: 20%, company: 10%) in memory.
- **Microsoft.Extensions.Http.Resilience 10.3.0**: Webhook delivery resilience — retry with exponential backoff + jitter, circuit breaker, timeout. Official Microsoft replacement for deprecated `Http.Polly`.
- **@foblex/flow 18.1.2**: Angular-native flow editor for visual workflow builder. MIT licensed, supports Angular Signals. Medium confidence — verify Angular 19.2.x compatibility before committing; fallback is a linear trigger → conditions → actions form layout.

Explicitly rejected: MediatR (hand-rolled command/handler pattern is already established), Redis (Hangfire uses PostgreSQL storage; add only when scaling to multiple servers), Elasticsearch (pg_trgm handles fuzzy matching at CRM scale), Monaco Editor (formula editor is a simple mat-autocomplete overlay, not a code editor), raw Polly (use `Microsoft.Extensions.Http.Resilience` which wraps it).

### Expected Features

Research across HubSpot, Pipedrive, Zoho, Salesforce Dynamics 365, and Freshsales with HIGH confidence established the following feature set:

**Must have (table stakes for v1.1):**
- **Workflow Automation** — event-based triggers (record created/updated, field changed), date-based triggers, field update / notify / create task / send email / fire webhook / enroll in sequence actions, execution log, enable/disable toggle
- **Email Templates** — rich text editor with Liquid merge fields, template categories, preview with sample data, clone
- **Email Sequences** — multi-step builder with delays, manual + workflow enrollment, auto-unenroll on reply, open/click tracking, sequence analytics
- **Formula / Computed Custom Fields** — arithmetic, date difference, string concatenation, IF/THEN, real-time recalculation on save, circular dependency detection
- **Duplicate Detection & Merge** — on-demand scan, real-time warning on create, configurable match rules, fuzzy matching, side-by-side merge UI, relationship transfer, merge audit trail
- **Webhooks** — subscription management, HMAC-SHA256 signing, retry with exponential backoff, delivery log, manual retry, test endpoint
- **Advanced Reporting Builder** — entity + field selection, filter builder, grouping/aggregation, related entity fields (1 level), chart + table view, save/share/export

**Should have (competitive differentiators):**
- Workflow-triggered email sequence enrollment (connects automation and sequences — most mid-tier CRMs treat these separately)
- Computed fields usable in report builder filters and aggregations (Pipedrive limits these to display-only)
- Webhook action in workflows (single trigger drives both internal logic and external integration)
- Upgrade existing CSV import duplicate detection to use new fuzzy matching engine
- Prebuilt workflow templates (5-10 common patterns: "New lead follow-up", "Deal won", "Stale deal reminder")
- Report drill-down: click chart bar to see filtered underlying records via existing dynamic table

**Defer to v1.2:**
- Scheduled report delivery (email on schedule)
- Sequence A/B testing
- Cross-entity workflow triggers ("when a deal's company gets updated")
- Cross-entity formula fields (formula on Contact referencing related Deal fields)
- Bulk merge with batch processing
- Per-contact timezone for sequence send windows

### Architecture Approach

v1.1 introduces three new cross-cutting concerns layered on the existing Clean Architecture: (1) a domain event system wired into `SaveChangesAsync` via `DomainEventInterceptor`; (2) Hangfire as the durable background processing backbone shared by all async features; (3) a dynamic expression evaluation layer via NCalc for formula fields, workflow conditions, and report query filters. All six features share these three infrastructure elements, which is why they must be built first.

**Major components:**
1. **DomainEventInterceptor** (Infrastructure) — captures entity changes before save, dispatches domain events after successful save. Triggers workflows, webhooks, duplicate checks, and formula recalculation from a single integration point. Critical: events captured in `SavingChangesAsync` (OriginalValues available) but dispatched in `SavedChangesAsync` (entity persisted).
2. **WorkflowEngine** (Infrastructure) — evaluates NCalc conditions against domain events, dispatches quick actions synchronously and slow actions (email, webhook, sequence enrollment) as Hangfire jobs. Must track execution depth to prevent infinite loops.
3. **Hangfire Job Server** (Infrastructure) — PostgreSQL-backed, 4 named queues (default, webhooks, emails, workflows), `TenantJobFilter` sets tenant context before every job execution. Used by: WorkflowActionJob, WebhookDeliveryJob, SequenceStepJob, DuplicateScanJob.
4. **FormulaEvaluator** (Application) — NCalc-based expression evaluator with CRM-specific functions (IF, CONCAT, DATEDIFF, TODAY, ROUND). Evaluate on-read, never store computed values in JSONB.
5. **FluidEmailTemplateRenderer** (Infrastructure) — renders Liquid templates with entity context. Coexists with existing RazorEmailRenderer for system emails.
6. **DuplicateDetectionService** (Infrastructure) — pg_trgm SQL pre-filter + FuzzySharp weighted composite scoring. Two-tier design avoids loading all records into memory.
7. **WebhookDeliveryService** (Infrastructure) — HMAC-SHA256 signed HTTP delivery via resilient HttpClient pipeline. Circuit breaker per endpoint after 3 consecutive failures.
8. **ReportQueryBuilder** (Infrastructure) — translates JSON report definitions to EF Core IQueryable chains (never raw SQL). Tenant isolation automatic via global query filters.
9. **12 new domain entities** — WorkflowDefinition, WorkflowExecutionLog, EmailTemplate, EmailSequence, EmailSequenceStep, SequenceEnrollment, SequenceStepLog, DuplicateCandidate, DuplicateRule, WebhookSubscription, WebhookDeliveryLog, ReportDefinition. All tenant-scoped with triple-layer isolation (TenantId + EF Core filter + PostgreSQL RLS).

### Critical Pitfalls

1. **Tenant context loss in background jobs** (Pitfall 2) — Hangfire jobs run outside HTTP request scope, so Finbuckle middleware never runs. Without explicit `TenantScope` wrapper that sets `ITenantProvider` from the job's `tenantId` parameter, EF Core global filters and PostgreSQL RLS receive null tenant context, causing cross-tenant data leakage or silent empty result sets. Build `TenantScope` infrastructure before any background processing feature.

2. **Workflow infinite loops** (Pitfall 1) — Workflows that update entities trigger further workflow evaluations. Without depth tracking, a two-workflow cycle burns CPU, exhausts database connections, floods SignalR, and fills audit tables within seconds — for all tenants simultaneously. Enforce execution depth limit (max 5), per-execution visited-set tracking, and per-tenant rate limiting (100 executions/min) from day one of workflow engine implementation.

3. **Duplicate merge broken FK references** (Pitfall 4) — Merging contacts requires updating every table that references the losing entity by ID, including polymorphic references (`feed_items.entity_id`, `notifications.entity_id`), JSONB Relation-type custom field values, and new v1.1 tables (sequence enrollments, workflow conditions). Missing any FK permanently destroys the merged entity's history. Use soft-delete with `MergedIntoId` redirect + full transaction + pre-merge FK enumeration + user confirmation with impact preview.

4. **Report builder tenant data leakage** (Pitfall 3) — Dynamic query construction risks bypassing EF Core global query filters via `FromSqlRaw`, raw SQL fragments, or accidental `IgnoreQueryFilters()`. Use LINQ-only report queries with whitelist field mapping; never expose raw SQL construction. PostgreSQL RLS is the safety net, not the primary defense.

5. **Webhook SSRF** (Pitfall 5) — Tenants can register webhook URLs pointing to cloud metadata endpoints (`169.254.169.254`), loopback, or internal services. Validate on registration AND re-resolve DNS on each delivery (DNS rebinding). Allow `https://` only, reject RFC1918 private ranges, limit redirects. Must be in first webhook implementation.

6. **Formula circular dependencies** (Pitfall 6) — Formula field A references field B which references field A causes infinite recursion on evaluation. Validate dependency graph on every formula save using topological sort; reject cycles immediately with clear error. Maximum dependency chain depth of 5.

## Implications for Roadmap

Based on the feature dependency graph from FEATURES.md and the build order analysis from ARCHITECTURE.md, the research recommends a 6-phase structure:

### Phase 1: Foundation — Hangfire + Email Templates + Formula Fields

**Rationale:** Email Templates and Formula Fields have no dependencies on other v1.1 features and are required by every subsequent phase. Hangfire is the async processing backbone required by all subsequent features. This is the mandatory starting point. The `TenantScope` background job wrapper and the Hangfire `TenantJobFilter` must be implemented here — before any feature adds background processing.

**Delivers:** Tenant-safe background job infrastructure with TenantJobFilter; user-editable email templates with Liquid merge fields, rich text editing, preview, and template categories; formula/computed custom fields with NCalc evaluation, circular dependency detection via topological sort, on-read evaluation strategy, and formula validation on save.

**Addresses:** Email Templates (all table stakes), Formula Fields (all table stakes), Hangfire integration (shared infrastructure)

**Avoids:** Pitfall 2 (TenantScope wrapper complete before downstream features add background jobs). Pitfall 6 (formula dependency graph + cycle detection from day one). Pitfall 15 (block deletion of custom fields referenced by formulas).

**Research flag:** Standard patterns — well-documented libraries (Hangfire, Fluid, NCalc). Skip research-phase; proceed directly to planning.

---

### Phase 2: Workflow Automation Engine

**Rationale:** The largest and most complex phase. Depends on Phase 1 (Hangfire for action dispatch, Email Templates for "send email" action). The DomainEventInterceptor is the integration point for workflows AND webhooks AND duplicate detection — it must be designed here to serve all downstream consumers. This is the architectural cornerstone of v1.1.

**Delivers:** DomainEventInterceptor wired to `SaveChangesAsync`; WorkflowEngine with NCalc condition evaluation; WorkflowActionJob covering field update, create activity, send notification, send email, fire webhook, and start sequence actions; workflow builder UI with trigger/condition/action form (using @foblex/flow or linear fallback); execution log with full audit trail; enable/disable toggle; prebuilt workflow templates (5-10 patterns).

**Addresses:** Workflow Automation (all table stakes sub-features), workflow-triggered sequence enrollment (differentiator), webhook action in workflows (differentiator)

**Avoids:** Pitfall 1 (execution depth limit, per-execution visited-set, per-tenant rate limiting designed in from the start). Pitfall 8 (admin-only workflow management, "execute as system with tenant isolation" model). Pitfall 10 (SignalR event batching for workflow-generated entity changes). Pitfall 17 (event-driven condition evaluation, not database polling).

**Research flag:** Needs deeper research during planning — DomainEventInterceptor interaction with existing AuditableEntityInterceptor, @foblex/flow Angular 19.2.x compatibility verification, workflow execution state machine completeness.

---

### Phase 3: Email Sequences

**Rationale:** Depends on Phase 1 (email templates for step content, Hangfire for delayed scheduling). Benefits from Phase 2 (workflows can trigger sequence enrollment). Relatively self-contained after foundation is in place — primarily adding enrollment management and step scheduling on top of existing email infrastructure.

**Delivers:** Multi-step sequence builder with delays; manual enrollment and workflow-triggered enrollment with idempotency constraint on `(sequence_id, contact_id)`; auto-unenroll on reply via Gmail sync integration; open/click tracking via pixel and link wrapping; sequence analytics (enrolled → opened → clicked → replied funnel); pause/resume individual enrollments; business hours send window; jittered send times.

**Addresses:** Email Sequences (all table stakes sub-features)

**Avoids:** Pitfall 7 (jittered send times, pre-send contact validation for deleted/merged/unsubscribed contacts, per-tenant sending rate limits). Pitfall 13 (HTML escaping of Liquid template output, HtmlSanitizer for template HTML).

**Research flag:** Auto-unenroll on reply requires careful integration with existing Gmail sync service — needs planning-phase review of email address matching logic and false positive handling.

---

### Phase 4: Webhooks

**Rationale:** Depends on Phase 1 (Hangfire for delivery jobs). Benefits from Phase 2 (DomainEventInterceptor publishes events that WebhookPublisher subscribes to). Relatively self-contained delivery pipeline. Simpler backend than workflows; simpler frontend (subscription CRUD + delivery log viewer) than most other phases.

**Delivers:** WebhookSubscription CRUD (admin-only); event type selection per subscription; HMAC-SHA256 payload signing with replay-attack timestamp; WebhookDeliveryService with Polly resilience pipeline; delivery log with per-attempt tracking (status, HTTP code, response time, payload); manual retry UI; test webhook endpoint (ping); SSRF URL validation on registration and each delivery.

**Addresses:** Webhooks (all table stakes sub-features)

**Avoids:** Pitfall 5 (SSRF prevention — `https://` only, RFC1918 rejection, DNS re-resolution on each delivery, 3-redirect limit). Pitfall 9 (circuit breaker per endpoint after 3 consecutive failures, max 5 retry attempts over ~1 hour, 1,000-delivery queue cap per endpoint). Pitfall 14 (minimal payload by default, admin-configurable field inclusion).

**Research flag:** Standard patterns — well-documented webhook delivery architecture. Skip research-phase.

---

### Phase 5: Duplicate Detection & Merge

**Rationale:** Depends on Phase 2 (DomainEventInterceptor fires on entity creation for real-time duplicate checks). Most complex data mutation phase — merge touches every FK relationship in the system, including new v1.1 tables created in Phases 1-4. Building this after other phases are complete means the full FK surface is known when writing the merge relationship transfer logic.

**Delivers:** `CREATE EXTENSION pg_trgm` migration + GIN trigram indexes on contacts (email, name) and companies (name, domain); DuplicateDetectionService (two-tier: pg_trgm pre-filter + FuzzySharp weighted scoring); on-demand bulk duplicate scan as Hangfire recurring job (daily 2 AM); real-time duplicate warning on contact/company create; configurable match rules per tenant (admin); side-by-side merge UI with field-level conflict resolution; relationship transfer covering all FKs including feed_items, notifications, sequence enrollments; soft-delete with `MergedIntoId` redirect; merge audit trail; enhanced CSV import duplicate detection; "not a duplicate" explicit dismissal.

**Addresses:** Duplicate Detection & Merge (all table stakes sub-features), enhanced import duplicate detection (differentiator), bulk duplicate review (table stakes)

**Avoids:** Pitfall 4 (comprehensive FK reference map documented before implementation; soft-delete with `MergedIntoId` redirect; full transaction; merge preview with impact counts; JSONB Relation-type value update via `jsonb_set`). Pitfall 12 (confidence scoring 0-100% not binary, threshold-based UX: >=90% auto-flag, 60-89% warning, <60% silent, never auto-merge).

**Research flag:** Needs planning-phase review — the complete FK reference map across all entities (v1.0 + v1.1) should be documented as a dedicated planning artifact before implementation begins. This is the most likely place for data loss to occur if a FK is missed.

---

### Phase 6: Advanced Reporting Builder

**Rationale:** Last phase because it benefits from all preceding data being operational (formula fields from Phase 1, workflow execution data from Phase 2, sequence analytics from Phase 3, webhook delivery stats from Phase 4). Reporting is also the feature with the highest tenant data leakage risk from dynamic query construction; building it last means tenant isolation patterns are proven and stable across the codebase.

**Delivers:** ReportDefinition entity + CRUD; ReportQueryBuilder (LINQ-only, whitelist field mapping); entity source + field + filter + grouping + aggregation configuration UI; related entity fields (1 level, e.g., Contact → Company.Name); Chart.js visualization reusing existing dashboard charts; table view with CSV export via existing CsvHelper; save + share reports (owner, name, config JSON, IsShared flag); date range parameter with preset ranges; report drill-down to filtered dynamic table; CdkVirtualScrollViewport for large result sets.

**Addresses:** Advanced Reporting Builder (all table stakes sub-features), report drill-down differentiator, computed fields in reports differentiator

**Avoids:** Pitfall 3 (LINQ-only construction, never `FromSqlRaw`, whitelist field mapping). Pitfall 11 (eager loading via dynamic `.Include()` chains, `.Select()` projections, 10,000-row cap with pagination, 30-second statement timeout, `AsAsyncEnumerable()` for CSV streaming). Pitfall 16 (maximum 3-level join depth, cardinality warnings at 100k estimated rows, 2 concurrent queries per tenant).

**Research flag:** Dynamic LINQ expression tree building for complex aggregations with JSONB custom fields needs validation during planning — EF Core translation edge cases with `GroupBy` over JSONB paths may require fallback to raw parameterized SQL with manual tenant filter.

---

### Phase Ordering Rationale

The dependency chain from FEATURES.md maps directly to this phase order:
- Phase 1 installs the three shared libraries (Hangfire, NCalc, Fluid) plus the two leaf-node features (Email Templates, Formula Fields) that every subsequent phase depends on
- Phase 2 (Workflow Engine) is the hub that references Phase 1 outputs; it also installs DomainEventInterceptor which Phases 4 and 5 consume
- Phase 3 (Sequences) and Phase 4 (Webhooks) are independent of each other — Sequences is placed before Webhooks because the reply-detection Gmail integration is more complex and benefits from earlier delivery
- Phase 5 (Duplicate Detection) is placed after Phases 1-4 so the full FK surface area from all v1.1 tables is known when building the merge relationship transfer logic
- Phase 6 (Reporting) comes last; it is the only phase that explicitly benefits from data produced by all other phases being operational, and it has the highest inherent security risk from dynamic query construction

Cross-cutting implementation priorities spanning all phases:
- **TenantScope wrapper**: Implement in Phase 1, required by every subsequent phase
- **RLS checklist per entity**: Apply to every new entity in every phase (Pitfall 18)
- **Idempotent job design**: Apply from Phase 1 forward to survive deployments (Pitfall 19)
- **OnPush change detection**: Maintain for all new Angular components (Pitfall 20)

### Research Flags

**Needs research-phase during planning:**
- **Phase 2 (Workflow Automation):** DomainEventInterceptor interaction with existing AuditableEntityInterceptor (both are SaveChangesInterceptors — verify ordering); @foblex/flow Angular 19.2.x runtime compatibility verification; workflow execution state machine edge cases (partial failure, compensation)
- **Phase 3 (Email Sequences):** Gmail sync service integration for reply detection — email address matching against active enrollments, false positive/negative handling
- **Phase 5 (Duplicate Detection):** Complete FK reference map across all v1.0 + v1.1 entities — document as explicit planning artifact before implementation begins
- **Phase 6 (Reporting):** Dynamic LINQ expression tree building with JSONB custom field aggregations — validate EF Core translation limits before committing to approach

**Standard patterns, skip research-phase:**
- **Phase 1 (Foundation):** Hangfire, Fluid, and NCalc are all well-documented with official guides and verified NuGet versions. Patterns are established.
- **Phase 4 (Webhooks):** Webhook delivery architecture is well-established industry pattern. HMAC signing, exponential retry, and circuit breakers are standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All NuGet package versions verified on NuGet.org with release dates. pg_trgm is a core PostgreSQL 17 extension. Single medium-confidence item: @foblex/flow Angular 19.2.x compatibility needs runtime verification. Fallback path (linear form builder) is well-defined. |
| Features | HIGH | Multi-source verification across 5+ major CRM platforms (HubSpot, Pipedrive, Zoho, Salesforce Dynamics 365, Freshsales). Table stakes vs. differentiators vs. anti-features are clearly established with citation to each platform. |
| Architecture | HIGH | Based on direct analysis of existing GlobCRM v1.0 codebase patterns (AuditableEntityInterceptor, TenantDbConnectionInterceptor, NotificationDispatcher, CrmHub) plus verified patterns for Hangfire multi-tenancy, EF Core interceptors, NCalc, and Fluid. All component boundaries are consistent with existing layer conventions. |
| Pitfalls | HIGH | Sourced from OWASP (SSRF), official Microsoft documentation (EF Core multi-tenancy, SignalR performance), vendor-specific CRM guides (Dynamics 365 calculated fields), and direct GlobCRM v1.0 codebase analysis. Critical pitfalls include specific prevention code patterns, not just general advice. |

**Overall confidence: HIGH**

### Gaps to Address

- **@foblex/flow Angular 19.2.x compatibility:** Verify in Phase 2 planning before committing to the visual workflow builder. Fallback (linear form-based builder using existing Angular Material + CDK) is well-defined and lower-risk. Decision should be made before Phase 2 planning begins.
- **DomainEventInterceptor ordering with AuditableEntityInterceptor:** Both intercept `SaveChangesAsync`. EF Core processes SaveChangesInterceptors in registration order. Verify that audit timestamps are set before domain events are captured (so event payloads include correct `UpdatedAt` values). Test with integration tests.
- **Workflow execution state machine for partial failures:** If a workflow executes 3 of 5 actions and the 4th fails (e.g., SendGrid returns 500), the state machine needs explicit handling: retry the failed action only, mark remaining actions as skipped, or roll back all. Decide during Phase 2 planning.
- **Gmail reply detection accuracy for sequence auto-unenroll:** Matching inbound email addresses against active enrollments has false negative risk (contact replies from different address) and false positive risk (different contact with similar email). Thresholds and fallback behavior need explicit design in Phase 3 planning.
- **ReportQueryBuilder EF Core translation limits:** Dynamic `.GroupBy()` + `.Select()` with JSONB field access through expression trees may hit EF Core 10 translation limitations. Fallback to raw parameterized SQL with manual `WHERE tenant_id = @tenantId` remains available and is documented in ARCHITECTURE.md.
- **Hangfire dashboard access control:** The Hangfire dashboard at `/hangfire` must be restricted to system administrators (not tenant admins). The `HangfireAdminAuthFilter` integration with the existing identity system needs explicit design in Phase 1.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [Hangfire.AspNetCore 1.8.23 on NuGet.org](https://www.nuget.org/packages/hangfire.aspnetcore/) — verified released 2026-02-05
- [Hangfire.PostgreSql 1.21.1 on NuGet.org](https://www.nuget.org/packages/Hangfire.PostgreSql/) — verified
- [Fluid.Core 2.31.0 on NuGet.org](https://www.nuget.org/packages/Fluid.Core/) — verified released 2025-11-07
- [NCalcSync 5.11.0 on NuGet.org](https://www.nuget.org/packages/NCalcSync) — verified
- [FuzzySharp 2.0.2 on NuGet.org](https://www.nuget.org/packages/FuzzySharp) — verified
- [Microsoft.Extensions.Http.Resilience 10.3.0 on NuGet.org](https://www.nuget.org/packages/Microsoft.Extensions.Http.Resilience/) — verified
- [PostgreSQL pg_trgm Documentation](https://www.postgresql.org/docs/current/pgtrgm.html) — core extension, PostgreSQL 17

**Feature Research:**
- [HubSpot Workflows Guide](https://knowledge.hubspot.com/workflows/create-workflows) — trigger types, action catalog
- [HubSpot Sequences](https://knowledge.hubspot.com/sequences/create-and-edit-sequences) — sequence creation, enrollment, tracking
- [Pipedrive Formula Fields Documentation](https://support.pipedrive.com/en/article/custom-fields-formula-fields) — formula syntax, limitations
- [Dynamics 365 Duplicate Detection](https://www.inogic.com/blog/2025/10/step-by-step-guide-to-duplicate-detection-and-merge-rules-in-dynamics-365-crm/) — merge flow
- [Zoho CRM Workflow Rules](https://help.zoho.com/portal/en/kb/crm/automate-business-processes/workflow-management/articles/configuring-workflow-rules) — trigger types
- [Webhook Architecture Design](https://beeceptor.com/docs/webhook-feature-design/) — subscription, delivery, retry patterns

**Architecture Research:**
- [Hangfire Documentation](https://docs.hangfire.io/en/latest/) — PostgreSQL storage, multi-tenant patterns
- [Fluid Template Engine (GitHub)](https://github.com/sebastienros/fluid) — rendering, context, filters
- [NCalc Documentation](https://ncalc.github.io/ncalc/) — expression parsing, custom functions
- [Microsoft Resilient HTTP Apps (.NET)](https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience) — Polly pipeline configuration
- Existing GlobCRM v1.0 codebase — AuditableEntityInterceptor, TenantDbConnectionInterceptor, NotificationDispatcher, CrmHub patterns

**Pitfalls Research:**
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Microsoft: EF Core Multi-tenancy](https://learn.microsoft.com/en-us/ef/core/miscellaneous/multitenancy)
- [Microsoft: EF Core Global Query Filters](https://learn.microsoft.com/en-us/ef/core/querying/filters)
- [Microsoft: SignalR Performance](https://learn.microsoft.com/en-us/aspnet/signalr/overview/performance/signalr-performance)
- [Dynamics 365: Calculated Fields and Circular Dependencies](https://learn.microsoft.com/en-us/dynamics365/customerengagement/on-premises/customize/define-calculated-fields)
- [Hangfire Discussion: Multi-Tenant Architecture](https://discuss.hangfire.io/t/hangfire-multi-tenant-architecture-per-tenant-recurring-jobs-vs-dynamic-enqueueing-at-scale/11400)
- [Hookdeck: Webhooks at Scale](https://hookdeck.com/blog/webhooks-at-scale)

### Secondary (MEDIUM confidence)

- [@foblex/flow npm registry](https://www.npmjs.com/package/@foblex/flow) — Angular-native flow editor; Angular 19 compatibility stated but not integration-tested against 19.2.x
- [Webhook Best Practices (Svix)](https://www.svix.com/resources/webhook-best-practices/retries/) — retry schedule recommendations
- [FuzzySharp GitHub](https://github.com/JakeBayer/FuzzySharp) — .NET port of Python FuzzyWuzzy, field weighting approach
- [CRM Deduplication Guide 2025](https://www.rtdynamic.com/blog/crm-deduplication-guide-2025/) — algorithm selection and thresholds
- [Inngest: Fixing Multi-Tenant Queueing Problems](https://www.inngest.com/blog/fixing-multi-tenant-queueing-concurrency-problems) — per-tenant rate limiting patterns

### Tertiary (LOW confidence — validate during planning)

- Dynamic LINQ expression tree approach for report queries with JSONB fields — pattern established but EF Core translation edge cases unknown until integration-tested
- Gmail reply detection matching logic for sequence auto-unenroll — integration with existing Gmail sync service needs explicit design review during Phase 3 planning

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
