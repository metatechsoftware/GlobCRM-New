# Milestones

## v1.0 MVP (Shipped: 2026-02-18)

**Phases completed:** 11 phases (1-11), 94 plans
**Commits:** 331
**Lines of code:** ~124,200 (75,600 C# + 48,600 TS/HTML/SCSS)
**Timeline:** 3 days (2026-02-16 to 2026-02-18)

**Key accomplishments:**
- Multi-tenant SaaS foundation with JWT auth, 2FA, triple-layer tenant isolation (Finbuckle + EF Core filters + PostgreSQL RLS), and invitation system
- Granular RBAC with per-entity permissions, field-level access, JSONB custom fields with GIN indexing, dynamic tables, and saved Views
- Full CRM entity suite: Companies, Contacts, Products, Deals (Kanban + pipeline), Activities (full workflow), Quotes (PDF generation), Requests, Notes with rich text
- Two-way Gmail integration with OAuth, email sync, threading, and automatic contact linking
- Real-time collaboration via SignalR notifications, news feed with social posts/comments, and configurable dashboards with 20 widget metrics and KPI targets
- Data operations: CSV import with field mapping, global search across all entities, unified calendar, file attachments, and responsive mobile design

**Delivered:** A complete multi-tenant SaaS CRM with 18 lazy-loaded feature areas, dynamic configurable tables on every list page, granular RBAC, real-time updates, Gmail integration, configurable dashboards, and responsive design.

---


## v1.1 Automation & Intelligence (Shipped: 2026-02-20)

**Phases completed:** 9 phases (13-21), 43 plans
**Commits:** ~195
**Lines of code:** ~234,600 total (~110,400 new in v1.1)
**Timeline:** 2 days (2026-02-18 to 2026-02-20)

**Key accomplishments:**
- Full lead management lifecycle with pipeline stages, source tracking, and one-click conversion to Contact + Company + Deal
- Rich email template system with Unlayer WYSIWYG editor, Fluid merge fields, and multi-step drip sequences with open/click tracking and reply-based auto-unenroll
- Formula/computed custom fields with NCalc expression engine supporting arithmetic, date, string, and conditional expressions — computed on-read with circular dependency detection
- Duplicate detection with two-tier fuzzy matching (pg_trgm + FuzzySharp), side-by-side comparison, and full contact/company merge with relationship transfer across all FK references
- HMAC-signed webhook delivery with exponential retry (7 attempts), SSRF prevention, delivery logs, and auto-disable after 50 consecutive failures
- Trigger-based workflow automation engine with 6 action types (field update, notify, task, email, webhook, sequence enrollment), visual canvas builder (@foblex/flow), execution logs, and prebuilt templates
- Dynamic report builder with entity/field selection, AND/OR filter trees, grouping/aggregation, Chart.js visualization (bar/line/pie) with drill-down, CSV export via Hangfire, and related entity fields
- Integration polish closing all audit gaps: ReportCsvExportJob DI registration, workflow action picker dropdowns, duplicate DI cleanup

**Delivered:** A connected automation platform where workflows orchestrate emails, webhooks, and sequences; reports leverage formula fields; duplicate detection runs on lead conversion; and all 57 requirements are satisfied across 9 phases.

### Known Tech Debt
- Visual canvas node rendering requires browser verification (code fix in 19-07)
- Template gallery completeness after cross-entity save requires browser verification (code fix in 19-07)
- Permission reload after 401-retry token refresh requires browser verification (code fix in 19-08)
- Running a new unsaved report is a silent no-op (documented as future saveAndRun pattern)
- SUMMARY frontmatter lacks requirements_completed field (3-source cross-reference relies on 2 sources)

---


## v1.2 Connected Experience (Shipped: 2026-02-20)

**Phases completed:** 5 phases (22-26), 19 plans
**Commits:** 81
**Lines of code:** ~275,300 total (~40,700 new in v1.2)
**Timeline:** 1 day (2026-02-20)

**Key accomplishments:**
- Entity Preview Sidebar: click entity names in feed, search, or My Day to open a slide-in preview with key properties, associations, recent activities, and quick actions — without navigating away
- Summary Tabs: rich at-a-glance overview as default first tab on all 6 entity detail pages (Company, Contact, Deal, Lead, Quote, Request) with batched aggregation endpoints, deal pipeline charts, email engagement, and dirty-flag invalidation
- My Day Personal Dashboard: personal daily workspace replacing generic home page with tasks, overdue urgency, upcoming events, pipeline summary, recent records, email summary, feed preview, notification digest, and quick actions
- Preview Sidebar Polish: quick actions from preview, preview-first global search, user profile popover from feed authors, full-width mobile responsive with swipe-to-close
- Cross-Feature Integration: EntityTypeRegistry for consistent entity metadata, SlideInPanelService for reusable slide-in panels, context-aware mutual exclusion, CDK Overlay patterns for popovers and panels

**Delivered:** A connected CRM experience where every entity is one click away — feed items, search results, and dashboard widgets all open entity previews, detail pages start with rich summary tabs, and users land on a personal My Day dashboard. All 37 requirements satisfied across 5 phases with 6 non-blocking tech debt items.

### Known Tech Debt
- `any[]` signal types in preview-notes-tab and preview-activities-tab components
- PREVIEW-02 uses push-content (side mode, 480px) instead of overlay per user design override
- TODO placeholder: company linking UI in slide-in follow-up (Phase 24)
- Unreachable email placeholder in slide-in @switch (Phase 24)
- EntityPreviewController missing Quote/Request backend handlers (returns 400 for these types)
- ENTITY_TABS missing Quote/Request entries (falls to default ['overview'])

---

