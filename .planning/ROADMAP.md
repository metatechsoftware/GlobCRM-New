# Roadmap: GlobCRM

## Overview

GlobCRM delivers a modern, multi-tenant SaaS CRM through 11 phases spanning foundation (authentication, multi-tenancy, RBAC), core CRM entities (companies, contacts, products), operational workflows (deals, activities, quotes), collaboration features (email sync, real-time updates, notifications), and power-user capabilities (dashboards, import/export, global search). The architecture prioritizes multi-tenant data isolation, custom field flexibility via JSONB, and dynamic table configuration as competitive differentiators. Phase execution follows dependency order, building stable foundations before layering complex features.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Multi-tenant infrastructure, authentication, and database architecture
- [x] **Phase 2: Core Infrastructure** - RBAC, custom fields system, and dynamic tables
- [x] **Phase 3: Core CRM Entities** - Companies, contacts, and products with CRUD operations
- [x] **Phase 4: Deals & Pipelines** - Configurable deal pipelines with Kanban board views
- [x] **Phase 5: Activities & Workflow** - Full activity lifecycle with state machine and timeline
- [x] **Phase 6: Quotes & Requests** - Line-item quotes with PDF generation and support requests
- [x] **Phase 7: Email Integration** - Two-way Gmail sync with OAuth and threading
- [x] **Phase 8: Real-Time & Notifications** - SignalR live updates and notification system (completed 2026-02-17)
- [x] **Phase 9: Dashboards & Reporting** - Configurable dashboards with KPIs and targets (completed 2026-02-17)
- [x] **Phase 10: Data Operations** - CSV import/export and global search across entities (completed 2026-02-17)
- [ ] **Phase 11: Polish & Completeness** - Calendar views, notes, attachments, news feed, and responsive design

## Phase Details

### Phase 1: Foundation
**Goal**: Secure, isolated multi-tenant infrastructure with user authentication
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password and receive verification email
  2. User can log in with JWT session that persists across browser refresh
  3. User can reset forgotten password via email link
  4. User can enable two-factor authentication and log out from any page
  5. System resolves tenant from subdomain and isolates all data per organization
  6. Admin can invite users to their organization via email
**Plans**: 8 plans

Plans:
- [ ] 01-01-PLAN.md -- .NET solution scaffolding + domain entities + database schema
- [ ] 01-02-PLAN.md -- Angular 19 scaffolding + core auth services
- [ ] 01-03-PLAN.md -- Multi-tenancy infrastructure + Identity/JWT authentication
- [ ] 01-04-PLAN.md -- Email service (SendGrid) + organization management endpoints
- [ ] 01-05-PLAN.md -- Invitation system + logout endpoint
- [ ] 01-06-PLAN.md -- Angular auth pages (login, signup, verify, forgot/reset password)
- [ ] 01-07-PLAN.md -- Angular 2FA setup, navbar/logout, onboarding wizard
- [ ] 01-08-PLAN.md -- End-to-end verification checkpoint

### Phase 2: Core Infrastructure
**Goal**: Permission system, custom fields architecture, and dynamic table foundation
**Depends on**: Phase 1
**Requirements**: RBAC-01, RBAC-02, RBAC-03, RBAC-04, RBAC-05, RBAC-06, CUST-01, CUST-02, CUST-03, CUST-04, CUST-05, CUST-06, CUST-07, VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06
**Success Criteria** (what must be TRUE):
  1. Admin can create custom roles with per-entity permissions and field-level access controls
  2. Admin can assign roles to users and organize them into teams
  3. System enforces permissions across all API endpoints and UI elements
  4. User can view and edit their own profile with name, avatar, and preferences
  5. Admin can define custom fields with all supported types (text, number, date, dropdown, checkbox, multi-select, currency, file, relation)
  6. Custom fields are stored in JSONB with GIN indexing and appear in dynamic tables
  7. User can adjust table columns, save Views with filters and sorting, and switch between personal and team-wide Views
**Plans**: 14 plans

Plans:
- [ ] 02-01-PLAN.md -- RBAC domain entities, enums, EF Core configs, and migration
- [ ] 02-02-PLAN.md -- Custom fields + views domain entities, EnableDynamicJson, and migration
- [ ] 02-03-PLAN.md -- User profile extension, SkiaSharp avatar service, file storage
- [ ] 02-04-PLAN.md -- RBAC authorization engine (PermissionService, handler, policy provider, role seeder)
- [ ] 02-05-PLAN.md -- Custom fields + views API controllers and repositories
- [ ] 02-06-PLAN.md -- User profile + team directory API controllers
- [ ] 02-07-PLAN.md -- RBAC API controllers (roles CRUD, teams CRUD, user assignment)
- [ ] 02-08-PLAN.md -- Angular dynamic table component, filter panel, views sidebar
- [ ] 02-09-PLAN.md -- Angular permission infrastructure (store, directives, guard)
- [ ] 02-10-PLAN.md -- Angular RBAC settings pages (role management, permission matrix, team management)
- [ ] 02-11-PLAN.md -- Angular custom fields settings, profile pages, avatar, team directory
- [ ] 02-12-PLAN.md -- End-to-end verification checkpoint
- [ ] 02-13-PLAN.md -- Gap closure: Frontend permission enforcement (adminGuard + *appHasPermission on settings pages)
- [ ] 02-14-PLAN.md -- Gap closure: GIN indexes for JSONB columns (custom_field_definitions + saved_views)

### Phase 3: Core CRM Entities
**Goal**: Companies, contacts, and products with full CRUD and relational navigation
**Depends on**: Phase 2
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, PROD-01, PROD-02, PROD-03, PROD-04, PROD-05
**Success Criteria** (what must be TRUE):
  1. User can create, view, edit, and delete companies with custom fields
  2. Company list page uses dynamic table and company detail shows entity timeline
  3. User can create, view, edit, and delete contacts and link them to companies
  4. Contact list page uses dynamic table and contact detail shows entity timeline
  5. User can navigate from company to related contacts, deals, quotes, and activities
  6. User can create products with name, description, unit price, SKU, and category for use in quotes
**Plans**: 9 plans

Plans:
- [ ] 03-01-PLAN.md -- Backend domain entities (Company, Contact, Product) + EF Core configs + migration + RLS
- [ ] 03-02-PLAN.md -- Frontend entity models, API services, and NgRx Signal Stores
- [ ] 03-03-PLAN.md -- Frontend shared components (custom-field-form, entity-timeline, related-entity-tabs)
- [ ] 03-04-PLAN.md -- Backend repositories with server-side query + TenantSeeder + permission seeder update
- [ ] 03-05-PLAN.md -- Backend API controllers (Companies, Contacts, Products) + timeline endpoints
- [ ] 03-06-PLAN.md -- Frontend Company feature (list + detail + form pages)
- [ ] 03-07-PLAN.md -- Frontend Contact feature (list + detail + form pages with company linking)
- [ ] 03-08-PLAN.md -- Frontend Product feature (list + detail + form pages)
- [ ] 03-09-PLAN.md -- Navbar CRM navigation + app routing + E2E verification checkpoint

### Phase 4: Deals & Pipelines
**Goal**: Configurable deal pipelines with Kanban board and multiple views
**Depends on**: Phase 3
**Requirements**: DEAL-01, DEAL-02, DEAL-03, DEAL-04, DEAL-05, DEAL-06, DEAL-07, DEAL-08, DEAL-09, DEAL-10
**Success Criteria** (what must be TRUE):
  1. Admin can configure multiple pipelines with custom stages per team
  2. Pipeline stages have configurable probabilities and required fields
  3. User can create deals with value, probability, expected close date, and assigned owner
  4. User can view deals as Kanban board with drag-and-drop stage changes
  5. User can view deals as list and calendar views
  6. User can link deals to contacts, companies, and products
  7. Deal detail page shows entity timeline with activities and stage history
**Plans**: 9 plans

Plans:
- [ ] 04-01-PLAN.md -- Backend domain entities (Pipeline, PipelineStage, Deal, DealContact, DealProduct, DealStageHistory) + EF Core configs + migration + RLS
- [ ] 04-02-PLAN.md -- Backend repositories (Pipeline + Deal) + TenantSeeder seed data wiring
- [ ] 04-03-PLAN.md -- Backend API controllers (PipelinesController + DealsController) with stage transitions + timeline
- [ ] 04-04-PLAN.md -- Frontend TypeScript models, API services (deal + pipeline), and DealStore signal store
- [ ] 04-05-PLAN.md -- Frontend pipeline admin settings pages (list + edit with stage management)
- [ ] 04-06-PLAN.md -- Frontend deal list with dynamic table + deal create/edit form
- [ ] 04-07-PLAN.md -- Frontend deal detail page with tabs, timeline, and entity linking
- [ ] 04-08-PLAN.md -- Frontend Kanban board with CDK drag-drop stage transitions
- [ ] 04-09-PLAN.md -- Frontend calendar view (FullCalendar) + routing + navbar + Deals tabs integration

### Phase 5: Activities & Workflow
**Goal**: Full activity workflow with state machine, timeline, and calendar views
**Depends on**: Phase 4
**Requirements**: ACTV-01, ACTV-02, ACTV-03, ACTV-04, ACTV-05, ACTV-06, ACTV-07, ACTV-08, ACTV-09, ACTV-10, ACTV-11, ACTV-12, ACTV-13, ACTV-14
**Success Criteria** (what must be TRUE):
  1. User can create activities (tasks, calls, meetings) with subject, description, and due date
  2. Activities follow full workflow: assigned → accepted → in progress → review → done
  3. User can assign activities to other users and set priority levels
  4. User can add comments, attachments, and track time spent on activities
  5. System maintains full audit trail showing who changed what and when
  6. User can view activities as list, board (Kanban), and calendar with drag-and-drop
  7. User can follow/watch activities to receive notifications on changes
  8. User can link activities to contacts, companies, deals, quotes, and requests
  9. Entity detail pages show activity timeline with all linked activities
**Plans**: 10 plans

Plans:
- [ ] 05-01-PLAN.md -- Backend domain entities (Activity + 6 child entities) + enums + EF Core configs + migration + RLS
- [ ] 05-02-PLAN.md -- Backend repository (ActivityRepository with filter/sort/scope/Kanban) + TenantSeeder seed data
- [ ] 05-03-PLAN.md -- Backend ActivitiesController core CRUD + status workflow + Kanban data + timeline
- [ ] 05-04-PLAN.md -- Backend sub-resource endpoints (comments, attachments, time entries, links, followers)
- [ ] 05-05-PLAN.md -- Frontend TypeScript models, ActivityService (21 methods), and ActivityStore signal store
- [ ] 05-06-PLAN.md -- Frontend activity list (DynamicTable) + activity create/edit form
- [ ] 05-07-PLAN.md -- Frontend activity detail page with 6 tabs (details, comments, attachments, time log, links, timeline)
- [ ] 05-08-PLAN.md -- Frontend Kanban board with fixed workflow columns and CDK drag-drop
- [ ] 05-09-PLAN.md -- Frontend calendar view (FullCalendar dayGridMonth with priority coloring)
- [ ] 05-10-PLAN.md -- Integration: routes, navbar, entity detail Activities tab enablement

### Phase 6: Quotes & Requests
**Goal**: Line-item quote builder with PDF generation and support request tracking
**Depends on**: Phase 5
**Requirements**: QUOT-01, QUOT-02, QUOT-03, QUOT-04, QUOT-05, QUOT-06, QUOT-07, QUOT-08, REQS-01, REQS-02, REQS-03, REQS-04, REQS-05, REQS-06
**Success Criteria** (what must be TRUE):
  1. User can create quotes with line items (product, quantity, unit price, discount, tax)
  2. Quote calculates subtotal, discount total, tax total, and grand total automatically
  3. User can generate PDF from quote and create new versions from existing quotes
  4. User can link quotes to deals and contacts
  5. User can create requests with status workflow (new → in progress → resolved → closed)
  6. Requests have priority, category, and assigned owner with links to contacts and companies
**Plans**: 7 plans

Plans:
- [ ] 06-01-PLAN.md -- Backend domain entities (Quote, QuoteLineItem, Request) + enums + EF Core configs + migration + RLS
- [ ] 06-02-PLAN.md -- Backend repositories (QuoteRepository + RequestRepository) + TenantSeeder seed data
- [ ] 06-03-PLAN.md -- Backend controllers (QuotesController + RequestsController) + QuestPDF PDF generation
- [ ] 06-04-PLAN.md -- Frontend TypeScript models, API services, and signal stores (Quote + Request)
- [ ] 06-05-PLAN.md -- Frontend Quote list (DynamicTable) + Quote form (line items FormArray + live calculations)
- [ ] 06-06-PLAN.md -- Frontend Quote detail (PDF download, versioning, status) + Request list + Request form
- [ ] 06-07-PLAN.md -- Frontend Request detail + routes + navbar + entity detail tabs integration

### Phase 7: Email Integration
**Goal**: Two-way Gmail sync with OAuth, threading, and automatic contact linking
**Depends on**: Phase 5
**Requirements**: MAIL-01, MAIL-02, MAIL-03, MAIL-04, MAIL-05, MAIL-06, MAIL-07
**Success Criteria** (what must be TRUE):
  1. User can connect Gmail account via OAuth with secure token management
  2. System syncs emails bidirectionally (inbox appears in CRM, sent from CRM appears in Gmail)
  3. User can view emails in CRM linked to contacts and companies
  4. User can send emails from CRM with tracked delivery
  5. System auto-links emails to known contacts by email address
  6. Emails appear in contact and company entity timelines
  7. User can view email threads with proper conversation threading
**Plans**: 7 plans

Plans:
- [ ] 07-01-PLAN.md -- Backend domain entities (EmailAccount, EmailMessage, EmailThread) + EF Core configs + migration + RLS
- [ ] 07-02-PLAN.md -- Gmail infrastructure services (OAuth, token encryption, service factory, sync engine, send service) + NuGet packages
- [ ] 07-03-PLAN.md -- Backend repositories + background sync service + API controllers (EmailAccounts + Emails)
- [ ] 07-04-PLAN.md -- Frontend TypeScript models, API services (email + account), and EmailStore signal store
- [ ] 07-05-PLAN.md -- Frontend email list (DynamicTable) + compose dialog + email account settings page
- [ ] 07-06-PLAN.md -- Frontend email detail (thread view) + entity tab integration + routing + navbar
- [ ] 07-07-PLAN.md -- End-to-end verification checkpoint (Google Cloud OAuth setup + full flow testing)

### Phase 8: Real-Time & Notifications
**Goal**: SignalR-powered live updates and comprehensive notification system
**Depends on**: Phase 7
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06, FEED-01, FEED-02, FEED-03, FEED-04, FEED-05
**Success Criteria** (what must be TRUE):
  1. User receives in-app notifications in bell icon with notification center
  2. User can mark notifications as read/unread and configure notification preferences
  3. User receives email notifications for important events (assignment, mention, due date)
  4. System delivers real-time notifications via SignalR without page refresh
  5. Notifications fire on activity assignment, deal stage change, mention, approaching due date, and email received
  6. User can view activity stream showing system events (deals moved, tasks completed, contacts added)
  7. User can create social posts visible to team and comment on feed items
  8. Feed combines activity stream and social posts in chronological order while respecting RBAC
**Plans**: 8 plans

Plans:
- [ ] 08-01-PLAN.md -- Backend domain entities (Notification, NotificationPreference, FeedItem, FeedComment) + enums + EF Core configs + migration + RLS
- [ ] 08-02-PLAN.md -- SignalR hub (CrmHub) + JWT query string auth + notification/feed repositories + NotificationDispatcher + email extension
- [ ] 08-03-PLAN.md -- Backend controllers (NotificationsController + FeedController) + DueDateNotificationService background service
- [ ] 08-04-PLAN.md -- Existing controller integration (DealsController, ActivitiesController, GmailSyncService notification dispatch)
- [ ] 08-05-PLAN.md -- Frontend SignalR client + notification feature (models, service, store, notification center bell icon)
- [ ] 08-06-PLAN.md -- Frontend feed feature (models, service, store, feed list + post form + comments)
- [ ] 08-07-PLAN.md -- Frontend notification preferences settings + feed routing + navbar integration
- [ ] 08-08-PLAN.md -- Gap closure: Wire markAsUnread in NotificationStore + add mark-as-unread UI button

### Phase 9: Dashboards & Reporting
**Goal**: Configurable dashboards with widgets, KPIs, targets, and drill-down
**Depends on**: Phase 8
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. User can view configurable dashboards with drag-and-drop widgets
  2. Dashboard widgets include charts (bar, line, pie), KPI cards, leaderboards, and tables
  3. User can set numeric targets (e.g., 50 calls/week, $100K pipeline) and track progress
  4. Dashboard supports date range filters and drill-down into underlying data
  5. Admin can create team-wide dashboards visible to all users
  6. User can create personal dashboards for individual tracking
**Plans**: 8 plans

Plans:
- [ ] 09-01-PLAN.md -- Backend domain entities (Dashboard, DashboardWidget, Target) + enums + EF Core configs + migration + RLS
- [ ] 09-02-PLAN.md -- Backend repositories + DashboardAggregationService (20 metrics) + DI registration
- [ ] 09-03-PLAN.md -- Backend DashboardsController (dashboard CRUD + batched widget data + target CRUD)
- [ ] 09-04-PLAN.md -- Frontend npm packages (ng2-charts, chart.js, angular-gridster2) + models + API service + signal store
- [ ] 09-05-PLAN.md -- Frontend widget components (KPI card, chart, leaderboard, table, target progress) + widget wrapper
- [ ] 09-06-PLAN.md -- Frontend dashboard grid (angular-gridster2) + widget config dialog + dashboard selector + date range filter
- [ ] 09-07-PLAN.md -- Frontend dashboard page (replaces existing static dashboard) + routing
- [ ] 09-08-PLAN.md -- Frontend target management + widget drill-down navigation + dashboard integration

### Phase 10: Data Operations
**Goal**: CSV import with field mapping and global search across all entities
**Depends on**: Phase 9
**Requirements**: IMPT-01, IMPT-02, IMPT-03, IMPT-04, IMPT-05, SRCH-01, SRCH-02, SRCH-03, SRCH-04
**Success Criteria** (what must be TRUE):
  1. User can import contacts, companies, and deals from CSV files
  2. Import supports field mapping (CSV columns to entity fields including custom fields)
  3. Import shows preview before executing with progress tracking and error reporting
  4. Import detects potential duplicates and offers skip/overwrite/merge options
  5. User can search across all entity types from a single search bar
  6. Search returns results grouped by entity type with partial matching
  7. Search is responsive (results as you type) and saves recent searches for quick access
**Plans**: 6 plans

Plans:
- [ ] 10-01-PLAN.md -- Backend domain entities (ImportJob, ImportJobError) + SearchVector tsvector on Company/Contact/Deal + EF Core configs + migration
- [ ] 10-02-PLAN.md -- Backend CSV import services (CsvHelper parser, ImportService, DuplicateDetector) + ImportsController API endpoints
- [ ] 10-03-PLAN.md -- Backend GlobalSearchService (PostgreSQL tsvector queries) + SearchController endpoint
- [ ] 10-04-PLAN.md -- Frontend import wizard (models, service, store, 4-step stepper: upload/map/preview/progress)
- [ ] 10-05-PLAN.md -- Frontend global search (navbar search bar, debounced type-ahead, grouped results, recent searches)
- [ ] 10-06-PLAN.md -- Frontend import history, routing, settings page integration

### Phase 11: Polish & Completeness
**Goal**: Calendar views, notes, attachments, news feed, and responsive web design
**Depends on**: Phase 10
**Requirements**: CALR-01, CALR-02, CALR-03, CALR-04, CALR-05, NOTE-01, NOTE-02, NOTE-03, NOTE-04, ATCH-01, ATCH-02, ATCH-03, ATCH-04, RESP-01, RESP-02, RESP-03
**Success Criteria** (what must be TRUE):
  1. User can view activities and events in day, week, and month calendar views
  2. User can create activities directly from calendar and drag-and-drop to reschedule
  3. Calendar shows activities from all linked entities with filters by type, owner, or entity
  4. User can create notes with rich text linked to any entity appearing in timelines
  5. User can upload files to any entity with preview and download capabilities
  6. Attachments are stored in cloud storage with tenant isolation and metadata tracking
  7. Angular web app works on desktop browsers and is responsive on tablet and mobile screen sizes
**Plans**: TBD

Plans:
- TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 8/8 | Complete | - |
| 2. Core Infrastructure | 14/14 | Complete | - |
| 3. Core CRM Entities | 9/9 | Complete | - |
| 4. Deals & Pipelines | 10/10 | Complete | - |
| 5. Activities & Workflow | 10/10 | Complete | - |
| 6. Quotes & Requests | 7/7 | Complete | 2026-02-17 |
| 7. Email Integration | 7/7 | Complete | 2026-02-17 |
| 8. Real-Time & Notifications | 8/8 | Complete | 2026-02-17 |
| 9. Dashboards & Reporting | 8/8 | Complete | 2026-02-17 |
| 10. Data Operations | 6/6 | Complete | 2026-02-17 |
| 11. Polish & Completeness | 0/TBD | Not started | - |
