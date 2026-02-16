# GlobCRM

## What This Is

GlobCRM is a modern, multi-tenant SaaS CRM for mid-size organizations (10–50 users) spanning sales, support, and operations. Teams manage their entire customer lifecycle — companies, contacts, deals, quotes, activities, email, and KPIs — through fast, consistent pages with dynamic tables, global search, and clean relational navigation. Available on web (Angular) and native mobile (.NET MAUI).

## Core Value

Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work without switching tools.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Companies, Contacts, Products, Quotes, Requests, Deals, Calendar, Notes, Activities/Tasks, Mail, News Feed, Targets/KPIs, Attachments, Notifications, Imports, Dynamic Tables
- [ ] Dynamic table columns (core fields + admin-defined custom fields) on every list page
- [ ] Per-user saved Views (column layouts, sorting, filters, grouping) with team-wide defaults + personal overrides
- [ ] Rich custom field types: text, number, date, dropdown, checkbox, multi-select, currency, formula/computed, file attachment, relation to other entities
- [ ] Global search across all entities
- [ ] Relational navigation (e.g., Company → Contacts, Quotes, Activities timeline)
- [ ] Full activity workflow: assigned → accepted → in progress → review → done, with comments, attachments, time tracking, full audit trail
- [ ] Activities viewable as list, board (Kanban), and calendar
- [ ] Entity-linked activity timelines
- [ ] Configurable deal pipelines with custom stages per team (Kanban view)
- [ ] Line-item quotes with products, quantities, discounts, tax, totals, PDF generation
- [ ] Two-way email sync with Gmail and Outlook (OAuth, see inbox, send from CRM, auto-link to contacts)
- [ ] News Feed combining activity stream (deals moved, tasks completed, contacts added) and social posts (team announcements, comments)
- [ ] Configurable dashboards with charts, leaderboards, and drill-down into data for Targets/KPIs
- [ ] Granular RBAC: custom roles with per-entity permissions (view/create/edit/delete) and field-level access
- [ ] Email + password authentication with optional 2FA
- [ ] Notifications: in-app (bell icon + notification center), email, push (mobile), real-time live updates
- [ ] Data import functionality
- [ ] Multi-tenant SaaS with isolated data per organization
- [ ] Native mobile apps (iOS/Android) via .NET MAUI
- [ ] Responsive web app (Angular) for desktop

### Out of Scope

- SSO/SAML/OIDC — email+password sufficient for v1, enterprise SSO deferred
- Real-time chat/messaging — not core to CRM value
- Video calls — integrate with external tools instead
- AI/ML features — predictive scoring, auto-categorization deferred
- Third-party marketplace/plugins — custom integrations deferred
- White-labeling — single brand for v1

## Context

**Domain:** CRM for mid-size organizations with sales, support, and operations teams. Users are sales reps, account managers, support agents, team leads, and admins. Daily workflows involve managing contacts, progressing deals through pipelines, completing assigned activities, sending/receiving email, and tracking KPIs.

**Key interaction pattern:** Dynamic tables are the primary UI pattern. Every list page (Companies, Contacts, Products, Quotes, Requests, Activities, Notes, Deals) uses the same configurable table component with adjustable columns, saved Views, sorting, filtering, and grouping. This pattern must be built once and reused everywhere.

**Custom fields architecture:** PostgreSQL JSONB columns store custom field values. Admin-defined field schemas support text, number, date, dropdown, checkbox, multi-select, currency, formula/computed, file attachment, and relation types. Custom fields appear alongside core fields in dynamic tables and are filterable/sortable.

**Activity workflow:** Central to daily operations. Full lifecycle: assigned → accepted → in progress → review → done. Includes comments, attachments, time tracking, and an auditable activity feed. Activities link to any entity (Company, Contact, Deal, Quote, Request) and appear in entity timelines.

**Email integration:** Two-way sync via Gmail API and Microsoft Graph API. OAuth-based connection. Emails appear in contact/company timelines, can be sent from CRM, and auto-link to known contacts by email address.

**Multi-tenancy:** Schema-per-tenant or row-level isolation in PostgreSQL. Each organization has isolated data. Tenant context resolved from subdomain or JWT claims.

## Constraints

- **Tech Stack**: Angular (frontend), .NET Core 10 Web API (backend), PostgreSQL (database), .NET MAUI (mobile) — team ecosystem decision
- **Multi-tenant**: Must support data isolation per organization from day one
- **API-first**: Backend must expose a clean REST API consumed by both Angular web app and MAUI mobile apps
- **Custom fields**: PostgreSQL JSONB for flexible schema; must be queryable and indexable
- **Email sync**: Requires OAuth flows for Gmail (Google API) and Outlook (Microsoft Graph API)
- **Real-time**: SignalR for live updates and notifications across web and mobile

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Angular over React/Vue | Team preference, strong enterprise patterns | — Pending |
| .NET Core 10 backend | Team expertise, strong typing, enterprise ecosystem | — Pending |
| PostgreSQL over SQL Server | Open source, superior JSONB support for custom fields | — Pending |
| .NET MAUI for mobile | Stay in .NET ecosystem, share models with backend | — Pending |
| JSONB for custom fields | Flexible schema without EAV table complexity, queryable | — Pending |
| SignalR for real-time | Native .NET integration, supports WebSocket + fallbacks | — Pending |
| Granular RBAC over simple roles | Mid-size orgs need per-entity and field-level permissions | — Pending |
| Full activity workflow | Operational clarity is a core differentiator | — Pending |

---
*Last updated: 2026-02-16 after initialization*
