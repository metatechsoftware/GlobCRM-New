# GlobCRM

## What This Is

GlobCRM is a modern, multi-tenant SaaS CRM for mid-size organizations (10-50 users) spanning sales, support, and operations. Teams manage their entire customer lifecycle — companies, contacts, deals, quotes, activities, email, and KPIs — through fast, consistent pages with dynamic tables, global search, and clean relational navigation. Built with Angular 19 (web) and .NET 10 (backend) on PostgreSQL 17.

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

### Active

- [ ] Native mobile apps (iOS/Android) via .NET MAUI
- [ ] Outlook/Microsoft 365 email integration (Microsoft Graph API)
- [ ] Email templates and sequences
- [ ] Formula/computed custom fields
- [ ] Workflow automation (trigger-based actions)
- [ ] Duplicate detection and merge for contacts and companies
- [ ] SSO/SAML/OIDC integration
- [ ] Bulk operations across list views
- [ ] Webhooks for external integrations
- [ ] Advanced reporting builder

### Out of Scope

- Real-time chat/messaging — not core to CRM value; integrate with Slack/Teams
- Video calls — integrate with external tools (Zoom, Teams)
- AI/ML features — predictive scoring, auto-categorization deferred until data volume supports it
- Third-party marketplace/plugins — webhooks + API sufficient
- White-labeling — single brand for now
- Full email client — sync + send-from-CRM is the right scope
- Multi-language/i18n — English-only for now

## Context

**Shipped v1.0 MVP** with ~124,200 LOC across 927 files.
- **Backend:** .NET 10 Web API (~75,600 C#), Clean Architecture (4 layers), EF Core + PostgreSQL 17
- **Frontend:** Angular 19 (~48,600 TS/HTML/SCSS), 18 lazy-loaded feature areas, standalone components with OnPush
- **Infrastructure:** Triple-layer multi-tenancy (Finbuckle + EF Core filters + PostgreSQL RLS), SignalR real-time, SendGrid email, QuestPDF, SkiaSharp

**Key interaction pattern:** Dynamic tables on every list page with configurable columns, saved Views, filters, and custom fields.

**Tech stack:** Angular 19 (web), .NET 10 (backend), PostgreSQL 17 (database), Angular Material M3 + Tailwind CSS (styling), SignalR (real-time), Chart.js + angular-gridster2 (dashboards), FullCalendar (calendar), ngx-quill (rich text), CsvHelper (imports)

## Constraints

- **Tech Stack**: Angular (frontend), .NET Core 10 Web API (backend), PostgreSQL (database), .NET MAUI (mobile)
- **Multi-tenant**: Data isolation per organization via triple-layer defense
- **API-first**: REST API consumed by both Angular web app and future MAUI mobile apps
- **Custom fields**: PostgreSQL JSONB for flexible schema; queryable and indexable with GIN
- **Email sync**: Requires OAuth flows for Gmail (done) and Outlook (future)
- **Real-time**: SignalR for live updates and notifications

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Angular over React/Vue | Team preference, strong enterprise patterns | ✓ Good — 18 feature areas with consistent patterns |
| .NET Core 10 backend | Team expertise, strong typing, enterprise ecosystem | ✓ Good — Clean Architecture with 4 layers works well |
| PostgreSQL over SQL Server | Open source, superior JSONB support for custom fields | ✓ Good — JSONB + GIN + tsvector + RLS all leveraged |
| .NET MAUI for mobile | Stay in .NET ecosystem, share models with backend | — Pending (v2) |
| JSONB for custom fields | Flexible schema without EAV table complexity, queryable | ✓ Good — GIN-indexed, works across all entities |
| SignalR for real-time | Native .NET integration, supports WebSocket + fallbacks | ✓ Good — notifications + feed updates work well |
| Granular RBAC over simple roles | Mid-size orgs need per-entity and field-level permissions | ✓ Good — enforced at API + UI level with scope checks |
| Full activity workflow | Operational clarity is a core differentiator | ✓ Good — 5-state machine with comments/attachments/time |
| Triple-layer tenant isolation | Defense-in-depth for data security | ✓ Good — Finbuckle + EF Core filters + PostgreSQL RLS |
| Component-provided signal stores | Per-page isolation avoids state leaking across features | ✓ Good — consistent pattern across all 18 features |
| Inline templates for simple components | Minimal file count, co-located template+logic | ✓ Good — reduced file sprawl without sacrificing readability |
| QuestPDF for quote generation | Free, fluent API, .NET native | ✓ Good — generates professional quote PDFs |
| FullCalendar for calendar views | Feature-rich, supports day/week/month + drag-drop | ✓ Good — used in deals, activities, and unified calendar |
| CSS-only responsive (no MatSidenav) | Avoid layout restructuring of app.component | ✓ Good — slide-in drawer works on mobile/tablet |

---
*Last updated: 2026-02-18 after v1.0 milestone*
