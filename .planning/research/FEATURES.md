# Feature Research: CRM for Mid-Size Organizations

**Domain:** Multi-tenant SaaS CRM
**Researched:** 2026-02-16
**Confidence:** HIGH
**References:** HubSpot, Pipedrive, Salesforce, Zoho CRM, Freshsales, Close CRM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Contact & Company CRUD | Core CRM function — users manage people and organizations | LOW | Standard forms, list views, detail pages. Foundation for everything. |
| Contact-Company relationships | Every CRM links contacts to organizations | LOW | Many-to-one (contact → company), many-to-many optional |
| Search across entities | Users expect to find anything instantly | MEDIUM | Global search bar, cross-entity results, recent searches |
| List views with sorting/filtering | Standard data grid behavior | MEDIUM | Column sorting, multi-filter, quick filters (status, owner) |
| Data import (CSV) | Every CRM supports CSV import for onboarding | MEDIUM | Field mapping, duplicate detection, progress tracking, error handling |
| Deal/opportunity tracking | Sales teams track revenue opportunities | MEDIUM | Deal stages, value, probability, expected close date |
| Activity logging (calls, meetings, tasks) | Sales reps log their work daily | MEDIUM | Quick-add forms, due dates, assignment, completion |
| Notes on any entity | Users expect free-text notes anywhere | LOW | Rich text, timestamps, author tracking |
| Email + password auth | Standard login flow | LOW | Registration, login, password reset, session management |
| User roles (Admin, Manager, Rep) | Mid-size teams need access control | MEDIUM | Role assignment, permission inheritance |
| Dashboard/home page | Users need at-a-glance summary of their work | MEDIUM | My activities, my deals, recent items |
| Attachments/file upload | Users attach documents to contacts, deals, quotes | LOW | File upload, preview, download. Cloud storage backend. |
| Calendar view for activities | Sales teams manage schedules | MEDIUM | Day/week/month views, drag-and-drop, create from calendar |
| Responsive web design | Users access CRM from various screen sizes | MEDIUM | Mobile-usable web, touch-friendly controls |
| Basic reporting | Managers need pipeline reports, activity summaries | MEDIUM | Pre-built reports: pipeline value, conversion rates, activity counts |
| Notifications (in-app) | Users need alerts for assignments, mentions, due dates | MEDIUM | Bell icon, notification center, read/unread state |
| Data export (CSV/Excel) | Users need to get data out for analysis | LOW | Export filtered list views, deal reports |
| Pagination on list views | Performance and usability for large datasets | LOW | Page-based or infinite scroll with result counts |
| Audit trail basics | Who changed what, when | MEDIUM | Created/modified timestamps, author on all records |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dynamic table columns with saved Views | Power users customize their workspace; team defaults ensure consistency | HIGH | Core differentiator for GlobCRM. Reusable across all entities. Per-user column selection, ordering, sizing, filters, grouping saved as Views. |
| Rich custom fields (formula, relation, currency) | Admins adapt CRM to their business without developer help | HIGH | JSONB storage. Formula fields compute from other fields. Relation fields link entities. |
| Full activity workflow (assigned → accepted → in progress → review → done) | Operational clarity beyond simple open/done task tracking | HIGH | State machine, role-based transitions, comments, time tracking, audit trail |
| Configurable deal pipelines per team | Different sales processes for different products/teams | MEDIUM | Admin-defined stages with probabilities, required fields per stage, multiple pipelines |
| Two-way email sync (Gmail + Outlook) | Emails automatically appear in CRM timeline without BCC | HIGH | OAuth integration, background sync, auto-link to contacts, send from CRM |
| Real-time live updates (SignalR) | See changes as they happen — no page refresh needed | HIGH | Deal stage changes, new activities, notifications pushed instantly |
| Combined news feed (activity + social) | Team communication + system events in one stream | MEDIUM | Activity stream + team posts/announcements/comments |
| Configurable dashboards with drill-down | Managers build their own KPI views, not locked to pre-built reports | HIGH | Drag-and-drop widgets, chart types, date range filters, click-through to data |
| Granular RBAC with field-level access | Fine control over who sees what — critical for regulated industries | HIGH | Custom roles, per-entity CRUD permissions, hide/read-only specific fields |
| Quote builder with line items + PDF | Generate professional quotes directly from deals with product catalog | HIGH | Product selection, quantity, discount, tax calculation, PDF template, versioning |
| Multi-tenant with data isolation | SaaS model — serve multiple organizations from one deployment | HIGH | Tenant-scoped data, configuration, branding. Foundation architecture decision. |
| Native mobile apps (.NET MAUI) | Full CRM experience on the go, not just a mobile website | HIGH | Offline support, push notifications, camera for attachments |
| Push notifications (mobile) | Reach users even when CRM not open | MEDIUM | Deal assignments, task due dates, mentions. FCM integration. |
| Kanban board view for deals + activities | Visual pipeline management with drag-and-drop | MEDIUM | Card-based view, stage columns, quick edit, filters |
| Targets/KPIs with leaderboards | Gamification and performance visibility motivate teams | MEDIUM | Numeric goals, progress bars, team rankings, time-based (weekly/monthly/quarterly) |
| Email notifications (digests) | Keep users informed via email for important events | LOW | Configurable: instant for urgent, daily digest for others |
| Saved filters and quick filters | Quickly switch between common data views | MEDIUM | Save complex filter combinations, share with team |
| Requests/tickets entity | Support operations alongside sales in one CRM | MEDIUM | Status workflow, priority, SLA tracking, assignment |
| Bulk operations (edit, delete, assign) | Productivity for managing large datasets | MEDIUM | Multi-select, bulk update form, progress tracking |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI-powered lead scoring | "Smart" prioritization sounds appealing | Requires large dataset to train, unreliable with small orgs, black box decisions | Manual scoring rules based on field values; formula custom fields |
| Full email client inside CRM | Users want one tool for everything | Competing with Gmail/Outlook is futile; maintenance burden enormous | Two-way sync + send-from-CRM. Users keep their email client. |
| Real-time collaborative editing | Users want to edit same record simultaneously | Massive complexity (CRDTs/OT), low actual value for CRM data | Optimistic locking with "user X is editing" indicator and merge on conflict |
| Marketplace/plugin system | Extensibility sounds future-proof | Enormous maintenance overhead, security risks, versioning nightmares | Webhooks + API for integrations; custom fields for data extension |
| Workflow automation builder (visual) | "If this then that" for CRM operations | High complexity to build well; most CRMs ship mediocre versions that frustrate users | Start with configurable triggers (e.g., auto-assign, stage change notifications). Build automation engine in v2. |
| Social media integration | "See contact's LinkedIn/Twitter in CRM" | APIs are unreliable/expensive, data quality issues, privacy concerns | Link fields to social profiles. Manual enrichment. |
| Mobile offline-first with full sync | "Works completely offline" | Conflict resolution is extremely complex for relational CRM data | Offline read for recently viewed records + queue offline creates/edits for sync when online |
| Unlimited custom field nesting | Custom fields that reference custom fields with formulas | Circular references, performance degradation, debugging nightmare | Allow one level of formula/relation references. No nested formulas. |

## Feature Dependencies

```
Authentication & Users
    └──requires──> Multi-Tenancy Infrastructure
                       └──requires──> Database Schema & API Foundation

Contact & Company CRUD
    └──requires──> Authentication & Users
    └──requires──> Custom Fields System

Deal Pipeline
    └──requires──> Contact & Company CRUD
    └──requires──> Products Entity

Quote Builder
    └──requires──> Deal Pipeline
    └──requires──> Products Entity

Activity Workflow
    └──requires──> Contact & Company CRUD
    └──requires──> Calendar System

Email Sync
    └──requires──> Contact & Company CRUD
    └──requires──> Background Jobs Infrastructure

Notifications (all channels)
    └──requires──> Authentication & Users
    └──requires──> Activity Workflow
    └──enhances──> Deal Pipeline
    └──enhances──> Email Sync

Real-Time Updates (SignalR)
    └──requires──> Authentication & Users
    └──enhances──> Notifications
    └──enhances──> Deal Pipeline (live Kanban)
    └──enhances──> Activity Workflow (live timeline)

News Feed
    └──requires──> Activity Workflow
    └──requires──> Authentication & Users
    └──enhances──> Notifications

Dashboards / KPIs
    └──requires──> Deal Pipeline (pipeline metrics)
    └──requires──> Activity Workflow (activity metrics)
    └──requires──> Contact & Company CRUD (data volume)

Dynamic Tables & Views
    └──requires──> Custom Fields System
    └──enhances──> Every list page (Companies, Contacts, Deals, etc.)

Mobile App (.NET MAUI)
    └──requires──> API-First Backend (all REST endpoints)
    └──requires──> Push Notification Infrastructure
    └──enhances──> Activity Workflow (log on the go)

Import
    └──requires──> Contact & Company CRUD
    └──requires──> Custom Fields System
    └──requires──> Duplicate Detection

RBAC (Granular)
    └──requires──> Authentication & Users
    └──enhances──> Every entity (permission filtering)
    └──enhances──> Custom Fields (field-level access)
```

### Dependency Notes

- **Deal Pipeline requires Contacts:** Deals are linked to contacts/companies
- **Quote Builder requires Products + Deals:** Line items reference products, quotes attach to deals
- **Email Sync requires Background Jobs:** Periodic sync runs as background process with OAuth token refresh
- **Real-Time enhances everything:** SignalR layer sits on top and can be added incrementally
- **Dynamic Tables requires Custom Fields:** Table columns include both core and custom fields
- **RBAC enhances everything:** Permission checks are cross-cutting; design early, enforce everywhere
- **Mobile requires API maturity:** Don't start mobile until web API is stable

## MVP Definition

### Launch With (v1)

Since user specified full feature set for v1, all features are included. However, build order matters:

- [ ] Multi-tenancy infrastructure — architectural foundation
- [ ] Auth + RBAC — security foundation
- [ ] Companies, Contacts, Products (core entities) — data foundation
- [ ] Custom fields system — enables dynamic tables
- [ ] Dynamic tables with saved Views — core differentiator
- [ ] Deals with configurable pipelines (Kanban) — sales workflow
- [ ] Activities with full workflow — operational backbone
- [ ] Quotes with line items + PDF — sales documentation
- [ ] Notes, Attachments — supporting entities
- [ ] Requests — support workflow
- [ ] Calendar — scheduling
- [ ] Email sync (Gmail + Outlook) — communication integration
- [ ] News Feed (activity + social) — team awareness
- [ ] Notifications (in-app, email, push, real-time) — engagement
- [ ] Dashboards with KPIs/Targets — management visibility
- [ ] Import — data onboarding
- [ ] Global search — findability
- [ ] Mobile app (.NET MAUI) — on-the-go access

### Add After Validation (v1.x)

- [ ] Workflow automation (basic triggers/actions) — when users request repetitive task automation
- [ ] Advanced reporting builder — when pre-built dashboards feel limiting
- [ ] Email templates and sequences — when sales teams want outbound campaigns
- [ ] Duplicate detection and merge — when data quality becomes an issue
- [ ] Webhooks for external integrations — when partners want to connect

### Future Consideration (v2+)

- [ ] SSO/SAML integration — when enterprise clients require it
- [ ] AI-powered insights — when data volume supports ML
- [ ] Public API with developer portal — when third-party ecosystem matters
- [ ] White-labeling — when reseller channel develops
- [ ] Multi-language/i18n — when international expansion begins

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-tenancy + Auth + RBAC | HIGH | HIGH | P1 |
| Companies, Contacts, Products CRUD | HIGH | MEDIUM | P1 |
| Custom Fields System | HIGH | HIGH | P1 |
| Dynamic Tables + Saved Views | HIGH | HIGH | P1 |
| Deal Pipelines (Kanban) | HIGH | MEDIUM | P1 |
| Activity Workflow (full lifecycle) | HIGH | HIGH | P1 |
| Quote Builder + PDF | HIGH | HIGH | P1 |
| Calendar | MEDIUM | MEDIUM | P1 |
| Notes & Attachments | MEDIUM | LOW | P1 |
| Requests | MEDIUM | MEDIUM | P1 |
| Email Sync (Gmail + Outlook) | HIGH | HIGH | P1 |
| News Feed | MEDIUM | MEDIUM | P1 |
| Notifications (all channels) | HIGH | HIGH | P1 |
| Real-time updates (SignalR) | MEDIUM | HIGH | P1 |
| Dashboards + KPIs | HIGH | HIGH | P1 |
| Import (CSV) | MEDIUM | MEDIUM | P1 |
| Global Search | HIGH | MEDIUM | P1 |
| Mobile App (.NET MAUI) | HIGH | HIGH | P1 |
| Bulk Operations | MEDIUM | MEDIUM | P2 |
| Export (CSV/Excel) | MEDIUM | LOW | P2 |
| Duplicate Detection | MEDIUM | HIGH | P2 |
| Workflow Automation | MEDIUM | HIGH | P3 |
| Email Templates | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (v1 full feature set)
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | HubSpot | Pipedrive | Salesforce | Zoho CRM | GlobCRM Approach |
|---------|---------|-----------|------------|----------|-----------------|
| Contact Management | Full with timeline | Deal-centric | Highly configurable | Full with social | Full with dynamic tables + custom fields |
| Deal Pipeline | Visual, configurable | Best-in-class Kanban | Highly configurable | Good with scoring | Configurable per team, Kanban + list + calendar |
| Custom Fields | Good variety | Limited types | Extremely flexible | Good variety | Rich types including formula, relation, currency |
| Views/Filters | Saved views, shared | Limited customization | List views + reports | Custom views | Dynamic table columns + team/personal saved Views |
| Email Integration | Built-in (HubSpot email) | 2-way sync | Einstein email | 2-way sync | 2-way sync Gmail + Outlook, send from CRM |
| Activity Management | Tasks, meetings, calls | Activities with reminders | Tasks + events | Tasks + events | Full workflow (5 stages), time tracking, audit trail |
| Quotes | Line items, templates | Basic quotes | CPQ add-on (expensive) | Good quote builder | Line items, PDF generation, versioning |
| Dashboards | Configurable, good charts | Limited (insights) | Highly configurable | Good dashboards | Configurable widgets, charts, leaderboards, drill-down |
| Mobile | Good native apps | Good native apps | Decent native apps | Good native apps | .NET MAUI native (iOS + Android) |
| Permissions | Role-based (tiers) | Visibility groups | Granular RBAC | Role-based | Granular RBAC with field-level access |
| Real-time | Limited | Limited | Limited | Limited | Full real-time with SignalR (differentiator) |
| Pricing | Free tier + expensive | Per-seat, affordable | Very expensive | Affordable | Multi-tenant SaaS (pricing TBD) |

## Sources

- HubSpot CRM feature pages and documentation
- Pipedrive feature comparison and pricing pages
- Salesforce Sales Cloud features and configuration guides
- Zoho CRM feature documentation
- Freshsales (Freshworks) CRM feature set
- Close CRM (communication-focused CRM) features
- G2 CRM category reports and user reviews
- CRM industry reports (Gartner, Forrester)

---
*Feature research for: Multi-tenant SaaS CRM*
*Researched: 2026-02-16*
