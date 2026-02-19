# GlobCRM

## What This Is

GlobCRM is a modern, multi-tenant SaaS CRM for mid-size organizations (10-50 users) spanning sales, support, and operations. Teams manage their entire customer lifecycle — companies, contacts, leads, deals, quotes, activities, email, and KPIs — through fast, consistent pages with dynamic tables, global search, and clean relational navigation. Built-in automation workflows orchestrate emails, webhooks, and sequences, while a report builder provides analytics across all entities. Built with Angular 19 (web) and .NET 10 (backend) on PostgreSQL 17.

## Core Value

Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work without switching tools.

## Requirements

### Validated

- ✓ Companies, Contacts, Products, Quotes, Requests, Deals, Calendar, Notes, Activities/Tasks, Mail, News Feed, Targets/KPIs, Attachments, Notifications, Imports, Dynamic Tables — v1.0
- ✓ Dynamic table columns (core fields + admin-defined custom fields) on every list page — v1.0
- ✓ Per-user saved Views (column layouts, sorting, filters, grouping) with team-wide defaults + personal overrides — v1.0
- ✓ Rich custom field types: text, number, date, dropdown, checkbox, multi-select, currency, file attachment, relation — v1.0
- ✓ Global search across all entities — v1.0
- ✓ Relational navigation (Company → Contacts, Quotes, Activities timeline) — v1.0
- ✓ Full activity workflow: assigned → accepted → in progress → review → done, with comments, attachments, time tracking, audit trail — v1.0
- ✓ Activities viewable as list, board (Kanban), and calendar — v1.0
- ✓ Entity-linked activity timelines — v1.0
- ✓ Configurable deal pipelines with custom stages per team (Kanban view) — v1.0
- ✓ Line-item quotes with products, quantities, discounts, tax, totals, PDF generation — v1.0
- ✓ Two-way email sync with Gmail (OAuth, see inbox, send from CRM, auto-link to contacts) — v1.0
- ✓ News Feed combining activity stream and social posts with comments — v1.0
- ✓ Configurable dashboards with charts, leaderboards, and drill-down for Targets/KPIs — v1.0
- ✓ Granular RBAC: custom roles with per-entity permissions and field-level access — v1.0
- ✓ Email + password authentication with optional 2FA — v1.0
- ✓ Notifications: in-app (bell icon + notification center), email, real-time via SignalR — v1.0
- ✓ Data import functionality (CSV with field mapping, duplicate detection) — v1.0
- ✓ Multi-tenant SaaS with isolated data per organization (triple-layer defense) — v1.0
- ✓ Responsive web app (Angular) for desktop, tablet, and mobile browsers — v1.0
- ✓ Full lead management with pipeline stages, source tracking, and one-click conversion to Contact + Company + Deal — v1.1
- ✓ Rich email templates with WYSIWYG editor, Fluid merge fields, categories, preview, and clone — v1.1
- ✓ Multi-step email sequences with delays, enrollment management, reply-based auto-unenroll, and per-step open/click tracking — v1.1
- ✓ Formula/computed custom fields with NCalc expressions (arithmetic, date, string, conditional), on-read evaluation, circular dependency detection — v1.1
- ✓ Duplicate detection with two-tier fuzzy matching (pg_trgm + FuzzySharp), configurable rules, side-by-side comparison, and contact/company merge with full relationship transfer — v1.1
- ✓ HMAC-signed webhooks with exponential retry, SSRF prevention, delivery logs, and auto-disable after 50 failures — v1.1
- ✓ Trigger-based workflow automation with 6 action types (field update, notify, task, email, webhook, sequence), visual builder, execution logs, and prebuilt templates — v1.1
- ✓ Dynamic report builder with entity/field selection, AND/OR filters, grouping/aggregation, chart visualization (bar/line/pie) with drill-down, CSV export, and related entity fields — v1.1

### Active

#### Current Milestone: v1.2 Connected Experience

**Goal:** Make GlobCRM feel connected — entity links in feeds open preview sidebars, every detail page starts with a Summary tab, and a personal "My Day" dashboard replaces the home page.

**Target features:**
- Feed deep integration with entity links + preview sidebar with actions
- Summary tabs on all major detail pages (Companies, Contacts, Deals, Leads, Quotes, Requests)
- Personal "My Day" dashboard replacing home page (configurable widgets)
- Org dashboard relocated to its own menu item

#### Future

- [ ] Native mobile apps (iOS/Android) via .NET MAUI
- [ ] Outlook/Microsoft 365 email integration (Microsoft Graph API)
- [ ] SSO/SAML/OIDC integration
- [ ] Bulk operations across list views

### Out of Scope

- Real-time chat/messaging — not core to CRM value; integrate with Slack/Teams
- Video calls — integrate with external tools (Zoom, Teams)
- AI/ML features — predictive scoring, auto-categorization deferred until data volume supports it
- Third-party marketplace/plugins — webhooks + API sufficient
- White-labeling — single brand for now
- Full email client — sync + send-from-CRM is the right scope
- Multi-language/i18n — English-only for now
- Visual flowchart workflow builder (drag-and-drop branching) — linear trigger→conditions→actions covers 90% of use cases; @foblex/flow canvas used for visualization only
- Cross-entity formula fields — requires join queries and cross-entity cache invalidation; same-entity only
- Undo merge — enormous storage/complexity for rarely-used feature; audit trail provided instead
- Per-contact timezone for sequences — use tenant timezone; per-contact requires timezone data on every contact

## Context

**Shipped v1.0 MVP** (2026-02-18) with ~124,200 LOC across 927 files.
**Shipped v1.1 Automation & Intelligence** (2026-02-20) with ~110,400 new LOC across 452 files.

**Current codebase:** ~234,600 LOC total
- **Backend:** .NET 10 Web API (C#), Clean Architecture (4 layers), EF Core + PostgreSQL 17
- **Frontend:** Angular 19 (TS/HTML/SCSS), 20+ lazy-loaded feature areas, standalone components with OnPush
- **Infrastructure:** Triple-layer multi-tenancy (Finbuckle + EF Core filters + PostgreSQL RLS), SignalR real-time, Hangfire background jobs, SendGrid/Gmail email, QuestPDF, SkiaSharp

**Key interaction pattern:** Dynamic tables on every list page with configurable columns, saved Views, filters, and custom fields.

**v1.1 additions:** Hangfire job server (PostgreSQL storage), DomainEventInterceptor (entity lifecycle events), Fluid template engine, NCalcSync formula evaluator, pg_trgm fuzzy matching, FuzzySharp scoring, @foblex/flow visual workflow builder, Unlayer email editor, Chart.js report visualization.

**Tech stack:** Angular 19 (web), .NET 10 (backend), PostgreSQL 17 (database), Angular Material M3 + Tailwind CSS (styling), SignalR (real-time), Hangfire (background jobs), Chart.js + angular-gridster2 (dashboards/reports), FullCalendar (calendar), ngx-quill (rich text), Unlayer (email templates), @foblex/flow (workflow canvas), NCalcSync (formulas), Fluid (Liquid templates), FuzzySharp (duplicate matching), CsvHelper (imports)

## Constraints

- **Tech Stack**: Angular (frontend), .NET Core 10 Web API (backend), PostgreSQL (database), .NET MAUI (mobile)
- **Multi-tenant**: Data isolation per organization via triple-layer defense
- **API-first**: REST API consumed by both Angular web app and future MAUI mobile apps
- **Custom fields**: PostgreSQL JSONB for flexible schema; queryable and indexable with GIN
- **Email sync**: Requires OAuth flows for Gmail (done) and Outlook (future)
- **Real-time**: SignalR for live updates and notifications
- **Background jobs**: Hangfire with PostgreSQL storage for webhooks, sequences, workflows, CSV exports

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Angular over React/Vue | Team preference, strong enterprise patterns | ✓ Good — 20+ feature areas with consistent patterns |
| .NET Core 10 backend | Team expertise, strong typing, enterprise ecosystem | ✓ Good — Clean Architecture with 4 layers works well |
| PostgreSQL over SQL Server | Open source, superior JSONB support for custom fields | ✓ Good — JSONB + GIN + tsvector + RLS + pg_trgm all leveraged |
| .NET MAUI for mobile | Stay in .NET ecosystem, share models with backend | — Pending (v2) |
| JSONB for custom fields | Flexible schema without EAV table complexity, queryable | ✓ Good — GIN-indexed, works across all entities including formulas |
| SignalR for real-time | Native .NET integration, supports WebSocket + fallbacks | ✓ Good — notifications + feed updates work well |
| Granular RBAC over simple roles | Mid-size orgs need per-entity and field-level permissions | ✓ Good — enforced at API + UI level with scope checks |
| Full activity workflow | Operational clarity is a core differentiator | ✓ Good — 5-state machine with comments/attachments/time |
| Triple-layer tenant isolation | Defense-in-depth for data security | ✓ Good — Finbuckle + EF Core filters + PostgreSQL RLS |
| Component-provided signal stores | Per-page isolation avoids state leaking across features | ✓ Good — consistent pattern across all 20+ features |
| Inline templates for simple components | Minimal file count, co-located template+logic | ✓ Good — reduced file sprawl without sacrificing readability |
| QuestPDF for quote generation | Free, fluent API, .NET native | ✓ Good — generates professional quote PDFs |
| FullCalendar for calendar views | Feature-rich, supports day/week/month + drag-drop | ✓ Good — used in deals, activities, and unified calendar |
| CSS-only responsive (no MatSidenav) | Avoid layout restructuring of app.component | ✓ Good — slide-in drawer works on mobile/tablet |
| Hangfire with PostgreSQL storage | No Redis needed at current scale; tenant-safe via TenantJobFilter | ✓ Good — webhooks, sequences, workflows, CSV export all use it |
| DomainEventInterceptor (fire-and-forget) | Shared infrastructure for webhooks, workflows, duplicate detection | ✓ Good — single interception point, AsyncLocal for pending events |
| Fluid (Liquid) for email templates | Fast, safe sandboxed template engine for merge fields | ✓ Good — works for templates, sequences, and workflow email actions |
| NCalcSync for formula fields | Expression evaluator with custom functions, no security risk | ✓ Good — arithmetic, date, string, conditional all supported |
| pg_trgm + FuzzySharp for duplicate detection | Two-tier: database pre-filter + in-memory scoring for accuracy | ✓ Good — handles typos and name variations well |
| @foblex/flow for workflow canvas | Angular-native flow library, simpler than jointjs/reactflow | ⚠️ Revisit — content projection issues required workarounds (inline fNode divs) |
| Connected automation system | Workflows orchestrate emails, webhooks, sequences; reports use formulas | ✓ Good — all features integrated end-to-end |
| Linear workflow model (not branching) | Covers 90% of use cases; branching adds exponential complexity | ✓ Good — trigger→conditions→actions sufficient for v1.1 |

---
*Last updated: 2026-02-20 after v1.2 milestone start*
