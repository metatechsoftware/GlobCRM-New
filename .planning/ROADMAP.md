# Roadmap: GlobCRM

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped 2026-02-18)
- **v1.1 Automation & Intelligence** — Phases 13-20 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-12) — SHIPPED 2026-02-18</summary>

- [x] Phase 1: Foundation (8/8 plans) — Multi-tenant infrastructure, authentication, database architecture
- [x] Phase 2: Core Infrastructure (14/14 plans) — RBAC, custom fields, dynamic tables
- [x] Phase 3: Core CRM Entities (9/9 plans) — Companies, contacts, products with CRUD
- [x] Phase 4: Deals & Pipelines (10/10 plans) — Configurable pipelines with Kanban board
- [x] Phase 5: Activities & Workflow (10/10 plans) — Full activity lifecycle with state machine
- [x] Phase 6: Quotes & Requests (7/7 plans) — Line-item quotes with PDF generation
- [x] Phase 7: Email Integration (7/7 plans) — Two-way Gmail sync with OAuth
- [x] Phase 8: Real-Time & Notifications (8/8 plans) — SignalR live updates and notifications
- [x] Phase 9: Dashboards & Reporting (8/8 plans) — Configurable dashboards with KPIs
- [x] Phase 10: Data Operations (6/6 plans) — CSV import and global search
- [x] Phase 11: Polish & Completeness (7/7 plans) — Calendar, notes, attachments, responsive design
- [x] Phase 12: Bug Fixes & Integration Polish (2/2 plans) — Gap closure from v1.0 audit

**Total:** 12 phases, 96 plans, ~124,200 LOC

</details>

### v1.1 Automation & Intelligence

**Milestone Goal:** Add workflow automation, email templates/sequences, computed fields, duplicate detection, webhooks, advanced reporting, and a Leads entity — all integrated as a connected system where workflows orchestrate emails, webhooks, and sequences, and reports leverage computed fields.

- [x] **Phase 13: Leads** - Full lead management with CRUD, dynamic table, pipeline stages, and lead-to-contact conversion
- [x] **Phase 14: Foundation Infrastructure & Email Templates** - Hangfire background jobs, TenantScope wrapper, DomainEventInterceptor, Fluid template engine, and rich email templates with merge fields (completed 2026-02-19)
- [x] **Phase 15: Formula / Computed Custom Fields** - NCalc expression evaluator, formula field type with arithmetic/date/string/conditional support, on-read evaluation, and circular dependency detection (completed 2026-02-19)
- [x] **Phase 16: Duplicate Detection & Merge** - Two-tier fuzzy matching (pg_trgm + FuzzySharp), configurable rules, side-by-side merge UI, and full relationship transfer (completed 2026-02-19)
- [x] **Phase 17: Webhooks** - HMAC-signed webhook delivery with exponential retry, subscription management, delivery logs, SSRF prevention (completed 2026-02-19)
- [x] **Phase 18: Email Sequences** - Multi-step drip sequences with delays, enrollment management, reply-based auto-unenroll, and per-step open/click tracking (completed 2026-02-19)
- [ ] **Phase 19: Workflow Automation** - Trigger-based automation engine with event/field-change/date triggers, multi-action execution (field update, notify, task, email, webhook, sequence), execution logs, and prebuilt templates
- [ ] **Phase 20: Advanced Reporting Builder** - Dynamic report builder with entity/field selection, filter conditions, grouping/aggregation, chart visualization, related entity fields, save/share, CSV export, and drill-down

## Phase Details

### Phase 13: Leads
**Goal**: Users can manage leads through a full lifecycle from capture to conversion, with the same dynamic table experience as all other CRM entities
**Depends on**: Phase 12 (v1.0 complete)
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, LEAD-06
**Success Criteria** (what must be TRUE):
  1. User can create, view, edit, and delete leads with all standard CRM fields (name, email, phone, company, source, status)
  2. User can view leads in a dynamic table with configurable columns, sorting, filtering, grouping, and saved Views — identical to all other entity list pages
  3. User can move leads through configurable pipeline stages (New, Contacted, Qualified, Unqualified, Converted) and track their source
  4. User can convert a qualified lead into a contact + company + deal in a single action, with all lead data carried over
  5. Leads support JSONB custom fields, activities, notes, and an entity timeline — consistent with the existing entity pattern
**Plans**: 4 plans

Plans:
- [x] 13-01-PLAN.md — Backend domain entities, EF configurations, repository, migration, RLS, and seed data
- [x] 13-02-PLAN.md — Backend API controllers (CRUD, stage transitions, conversion, Kanban, timeline, admin)
- [x] 13-03-PLAN.md — Frontend models, service, store, routes, list page, and Kanban board
- [x] 13-04-PLAN.md — Frontend detail page with stepper, create/edit form, and conversion dialog

### Phase 14: Foundation Infrastructure & Email Templates
**Goal**: Shared background processing infrastructure is operational and tenant-safe, and users can create rich email templates with merge fields for use by downstream features (sequences, workflows)
**Depends on**: Phase 12 (v1.0 complete)
**Requirements**: ETMPL-01, ETMPL-02, ETMPL-03, ETMPL-04, ETMPL-05
**Success Criteria** (what must be TRUE):
  1. Hangfire job server is running with PostgreSQL storage, named queues (default, webhooks, emails, workflows), and a TenantJobFilter that correctly propagates tenant context to all background jobs
  2. DomainEventInterceptor captures entity create/update/delete events from SaveChangesAsync and dispatches them after successful save — available for webhooks, workflows, and duplicate detection in later phases
  3. User can create and edit rich text email templates with a WYSIWYG editor, insert merge fields (contact, deal, company data), organize templates into categories, preview with real entity data, and clone existing templates
  4. Email templates render correctly with Liquid template engine (Fluid), resolving all merge fields to actual entity values
**Plans**: 4 plans

Plans:
- [ ] 14-01-PLAN.md — Backend infrastructure (Hangfire, DomainEventInterceptor, TenantJobFilter) + EmailTemplate domain entities, EF config, migration, RLS, Fluid render/merge services, RBAC
- [ ] 14-02-PLAN.md — Email template API controllers (CRUD, preview, test send, clone), category API, merge fields API, Program.cs wiring, Hangfire dashboard, TenantSeeder starter templates
- [ ] 14-03-PLAN.md — Frontend models, service, store, routes, Unlayer editor with merge field panel, template list page with thumbnails
- [ ] 14-04-PLAN.md — Frontend preview dialog (desktop/mobile toggle, real entity selector, test send), clone dialog, category filter polish, navbar navigation

### Phase 15: Formula / Computed Custom Fields
**Goal**: Admins can define formula-based custom fields that automatically compute values from other fields, extending the custom field system with calculated intelligence
**Depends on**: Phase 12 (v1.0 complete)
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05
**Success Criteria** (what must be TRUE):
  1. Admin can create formula custom fields with arithmetic expressions that reference other fields on the same entity (e.g., `[deal_value] * [probability]`)
  2. Formula fields support date difference calculations, string concatenation, and conditional logic (IF/THEN/ELSE)
  3. Formula values are computed on-read (server-side) and displayed as read-only columns in dynamic tables, detail pages, and all other views
  4. Admin receives immediate, clear validation feedback when creating formulas with syntax errors, invalid field references, or circular dependencies (detected via topological sort)
**Plans**: 4 plans

Plans:
- [ ] 15-01-PLAN.md — Backend domain model extension, NCalc engine, formula evaluation/validation/registry services
- [ ] 15-02-PLAN.md — Backend API endpoints (validate, preview, field-registry) and formula evaluation in all entity DTO mappings
- [ ] 15-03-PLAN.md — Frontend formula editor with autocomplete, live preview, and custom-field-edit-dialog integration
- [ ] 15-04-PLAN.md — Frontend formula display in dynamic tables (#ERR with tooltip) and detail page custom field forms

### Phase 16: Duplicate Detection & Merge
**Goal**: Users can detect and merge duplicate contacts and companies with confidence, preserving all relationships and history on the surviving record
**Depends on**: Phase 14 (DomainEventInterceptor for real-time create warnings)
**Requirements**: DUP-01, DUP-02, DUP-03, DUP-04, DUP-05, DUP-06, DUP-07
**Success Criteria** (what must be TRUE):
  1. System warns the user of potential duplicates in real-time when creating a new contact or company, using fuzzy matching that handles typos and name variations
  2. User can run an on-demand duplicate scan for contacts and companies, and admin can configure matching rules and similarity thresholds per tenant
  3. User can view a side-by-side comparison of duplicate records showing all fields, with clear indication of differences
  4. User can merge duplicate contacts or companies, with all relationships (deals, activities, notes, emails, attachments, feed items, notifications, sequence enrollments) transferred to the surviving record
  5. Merged records are soft-deleted with a MergedIntoId redirect, and a full merge audit trail is preserved
**Plans**: 4 plans

Plans:
- [ ] 16-01-PLAN.md — Backend foundation: domain entities, pg_trgm extension, DuplicateDetectionService, ContactMergeService, CompanyMergeService
- [ ] 16-02-PLAN.md — Backend API: DuplicatesController (check, scan, merge-preview, merge), DuplicateSettingsController, merged-record redirect
- [ ] 16-03-PLAN.md — Frontend scan page and merge comparison page with side-by-side field selection
- [ ] 16-04-PLAN.md — Frontend create form duplicate warnings, admin settings page, merged-record redirect handling

### Phase 17: Webhooks
**Goal**: Admins can subscribe external systems to CRM entity events via secure, reliable webhook delivery with full observability
**Depends on**: Phase 14 (Hangfire for delivery jobs, DomainEventInterceptor for entity events)
**Requirements**: WHOOK-01, WHOOK-02, WHOOK-03, WHOOK-04, WHOOK-05, WHOOK-06
**Success Criteria** (what must be TRUE):
  1. Admin can create webhook subscriptions, selecting which entity event types (create, update, delete) trigger delivery to a specified URL
  2. Webhook payloads are signed with HMAC-SHA256, enabling external systems to verify authenticity and prevent tampering
  3. Failed webhook deliveries are automatically retried with exponential backoff (up to 7 attempts), and subscriptions auto-disable after 50 consecutive failures
  4. Admin can view a delivery log showing each attempt's status, HTTP response code, and timing, and can test a subscription with a sample payload
  5. Webhook URLs are validated against SSRF attacks (HTTPS-only, RFC1918 rejection, DNS re-resolution on each delivery)
**Plans:** 4/4 plans complete
- [ ] 17-01-PLAN.md — Backend foundation: domain entities, EF configs, migration, RLS, DomainEvent OldValues enhancement, repository
- [ ] 17-02-PLAN.md — Backend delivery pipeline: domain event handler, delivery service with HMAC signing and retry, SSRF validator, payload builder
- [ ] 17-03-PLAN.md — Backend API: WebhooksController with subscription CRUD, delivery logs, test webhook, manual retry
- [ ] 17-04-PLAN.md — Frontend: subscription list/edit/detail, global delivery log, test dialog, settings routes

### Phase 18: Email Sequences
**Goal**: Users can create automated multi-step email drip campaigns that send templated emails on a schedule, with enrollment management and performance tracking
**Depends on**: Phase 14 (Hangfire for delayed scheduling, Email Templates for step content)
**Requirements**: ESEQ-01, ESEQ-02, ESEQ-03, ESEQ-04, ESEQ-05, ESEQ-06, ESEQ-07
**Success Criteria** (what must be TRUE):
  1. User can create a multi-step email sequence with configurable delays between steps, using email templates for each step's content
  2. User can manually enroll individual contacts or bulk-enroll contacts from a list view multi-select into a sequence
  3. Contacts are automatically unenrolled when they reply to a sequence email, and users can manually pause/resume individual enrollments
  4. User can view per-step tracking metrics (open rate, click rate) and sequence-level analytics (enrolled, completed, replied, bounced)
**Plans**: 5 plans

Plans:
- [ ] 18-01-PLAN.md — Backend domain entities, EF configurations, migration, RLS, repositories, and seed data
- [ ] 18-02-PLAN.md — Backend execution engine (Hangfire jobs), email sender with tracking, reply detector
- [ ] 18-03-PLAN.md — Backend API controller (CRUD, enrollment, analytics endpoints) and RBAC permissions
- [ ] 18-04-PLAN.md — Frontend sequence builder (CDK drag-drop), list, detail page with enrollment management
- [ ] 18-05-PLAN.md — Frontend DynamicTable row selection, bulk enrollment, analytics (funnel chart + metrics), contact detail action

### Phase 19: Workflow Automation
**Goal**: Users can automate CRM operations by creating trigger-based workflows that execute actions (field updates, notifications, tasks, emails, webhooks, sequence enrollment) when entity events or conditions are met
**Depends on**: Phase 14 (Hangfire, DomainEventInterceptor, Email Templates), Phase 17 (Webhooks for WFLOW-08), Phase 18 (Sequences for WFLOW-09)
**Requirements**: WFLOW-01, WFLOW-02, WFLOW-03, WFLOW-04, WFLOW-05, WFLOW-06, WFLOW-07, WFLOW-08, WFLOW-09, WFLOW-10, WFLOW-11, WFLOW-12, WFLOW-13
**Success Criteria** (what must be TRUE):
  1. User can create a workflow with event triggers (record created/updated/deleted), field-change triggers with conditions (equals, changed to, greater than), and date-based triggers (X days before/after a date field)
  2. User can add multiple actions to a single workflow: update field, send notification, create activity/task, send email (via template with merge fields), fire webhook, and enroll contact in sequence
  3. User can view detailed workflow execution logs showing which trigger fired, which conditions were evaluated, and the result of each action
  4. User can enable/disable workflows without deleting them, and admin can select from prebuilt workflow templates as starting points
  5. Workflow engine enforces execution depth limits and loop prevention to avoid infinite cascading triggers
**Plans**: TBD

### Phase 20: Advanced Reporting Builder
**Goal**: Users can build custom reports by selecting entity sources, fields (including formula fields and related entity fields), filters, groupings, and visualizations — then save, share, and export them
**Depends on**: Phase 15 (Formula fields available as report columns/filters)
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, RPT-08
**Success Criteria** (what must be TRUE):
  1. User can create a report by selecting an entity source, choosing fields/columns (including formula fields and related entity fields one level deep), and adding filter conditions with AND/OR logic
  2. User can group report results and apply aggregations (count, sum, average, min, max) to numeric and formula fields
  3. User can visualize report results as charts (bar, line, pie) or as a data table, and drill down from a chart data point to view the underlying records
  4. User can save reports, share them with team members, and export results to CSV
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20

**Dependency Note:** Phases 13, 14, 15 have no inter-dependencies and could execute in parallel. Phases 16, 17, 18 all depend on Phase 14 but are independent of each other. Phase 19 depends on 14 + 17 + 18. Phase 20 depends on 15.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 8/8 | Complete | 2026-02-16 |
| 2. Core Infrastructure | v1.0 | 14/14 | Complete | 2026-02-16 |
| 3. Core CRM Entities | v1.0 | 9/9 | Complete | 2026-02-16 |
| 4. Deals & Pipelines | v1.0 | 10/10 | Complete | 2026-02-17 |
| 5. Activities & Workflow | v1.0 | 10/10 | Complete | 2026-02-17 |
| 6. Quotes & Requests | v1.0 | 7/7 | Complete | 2026-02-17 |
| 7. Email Integration | v1.0 | 7/7 | Complete | 2026-02-17 |
| 8. Real-Time & Notifications | v1.0 | 8/8 | Complete | 2026-02-17 |
| 9. Dashboards & Reporting | v1.0 | 8/8 | Complete | 2026-02-17 |
| 10. Data Operations | v1.0 | 6/6 | Complete | 2026-02-17 |
| 11. Polish & Completeness | v1.0 | 7/7 | Complete | 2026-02-18 |
| 12. Bug Fixes & Integration Polish | v1.0 | 2/2 | Complete | 2026-02-18 |
| 13. Leads | v1.1 | Complete    | 2026-02-18 | 2026-02-18 |
| 14. Foundation Infrastructure & Email Templates | 4/4 | Complete    | 2026-02-19 | - |
| 15. Formula / Computed Custom Fields | 4/4 | Complete    | 2026-02-19 | - |
| 16. Duplicate Detection & Merge | 4/4 | Complete    | 2026-02-19 | - |
| 17. Webhooks | 4/4 | Complete    | 2026-02-19 | - |
| 18. Email Sequences | 5/5 | Complete    | 2026-02-19 | - |
| 19. Workflow Automation | v1.1 | 0/? | Not started | - |
| 20. Advanced Reporting Builder | v1.1 | 0/? | Not started | - |
